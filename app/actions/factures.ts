'use server'

import { query } from '@/lib/db/postgres'
import { getSession } from '@/lib/auth/session'
import { factureSchema, type FactureFormData } from '@/lib/validations/facture'
import { revalidatePath } from 'next/cache'
import { Resend } from 'resend'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { FacturePDF } from '@/lib/pdf/facture-pdf'
import { FactureEmailTemplate, FactureEmailText } from '@/lib/email/templates/facture-email'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function createFactureAction(formData: FactureFormData) {
  try {
    // Validation
    const validatedData = factureSchema.parse(formData)

    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    // Générer le numéro de facture
    const currentYear = new Date().getFullYear()

    // Récupérer la dernière facture de l'année
    const lastFactureResult = await query(
      'SELECT sequence FROM factures WHERE user_id = $1 AND annee = $2 ORDER BY sequence DESC LIMIT 1',
      [userId, currentYear]
    )

    const nextSequence = lastFactureResult.rows.length > 0 ? lastFactureResult.rows[0].sequence + 1 : 1
    const numeroFacture = `F${currentYear}${String(nextSequence).padStart(4, '0')}`

    // Calculer montants
    const montant_ht = validatedData.montant_ht
    const taux_tva = validatedData.taux_tva || 19
    const montant_tva = (montant_ht * taux_tva) / 100
    const montant_ttc = montant_ht + montant_tva

    // Préparer les données
    const factureData = {
      user_id: userId,
      client_id: validatedData.client_id,
      dossier_id: validatedData.dossier_id || null,
      numero: numeroFacture,
      annee: currentYear,
      sequence: nextSequence,
      montant_ht,
      taux_tva,
      montant_tva,
      montant_ttc,
      date_emission: validatedData.date_emission,
      date_echeance: validatedData.date_echeance || null,
      date_paiement: null,
      statut: validatedData.statut,
      objet: validatedData.objet,
      notes: validatedData.notes || null,
    }

    const columns = Object.keys(factureData).join(', ')
    const values = Object.values(factureData)
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')

    const result = await query(
      `INSERT INTO factures (${columns}) VALUES (${placeholders}) RETURNING *`,
      values
    )

    revalidatePath('/factures')
    return { success: true, data: result.rows[0] }
  } catch (error) {
    console.error('Erreur validation:', error)
    return { error: 'Données invalides' }
  }
}

export async function updateFactureAction(id: string, formData: Partial<FactureFormData>) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    // Whitelist des colonnes autorisées pour éviter SQL injection
    const ALLOWED_UPDATE_FIELDS = [
      'client_id',
      'dossier_id',
      'montant_ht',
      'taux_tva',
      'montant_tva',
      'montant_ttc',
      'date_emission',
      'date_echeance',
      'date_paiement',
      'statut',
      'objet',
      'notes',
    ]

    // Recalculer les montants si montant_ht ou taux_tva changent
    let updateData: any = { ...formData }

    if (formData.montant_ht !== undefined || formData.taux_tva !== undefined) {
      const currentResult = await query(
        'SELECT montant_ht, taux_tva FROM factures WHERE id = $1 AND user_id = $2',
        [id, userId]
      )

      if (currentResult.rows.length > 0) {
        const currentFacture = currentResult.rows[0]
        const montant_ht = formData.montant_ht ?? currentFacture.montant_ht
        const taux_tva = formData.taux_tva ?? currentFacture.taux_tva
        const montant_tva = (montant_ht * taux_tva) / 100
        const montant_ttc = montant_ht + montant_tva

        updateData = {
          ...updateData,
          montant_tva,
          montant_ttc,
        }
      }
    }

    // Filtrer uniquement les colonnes autorisées
    const sanitizedData: any = {}
    Object.keys(updateData).forEach((key) => {
      if (ALLOWED_UPDATE_FIELDS.includes(key)) {
        sanitizedData[key] = updateData[key]
      }
    })

    if (Object.keys(sanitizedData).length === 0) {
      return { error: 'Aucune donnée valide à mettre à jour' }
    }

    const setClause = Object.keys(sanitizedData)
      .map((key, i) => `${key} = $${i + 1}`)
      .join(', ')
    const values = [...Object.values(sanitizedData), id, userId]

    const result = await query(
      `UPDATE factures SET ${setClause} WHERE id = $${values.length - 1} AND user_id = $${values.length} RETURNING *`,
      values
    )

    if (result.rows.length === 0) {
      return { error: 'Facture introuvable' }
    }

    revalidatePath('/factures')
    revalidatePath(`/factures/${id}`)
    return { success: true, data: result.rows[0] }
  } catch (error) {
    console.error('Erreur mise à jour:', error)
    return { error: 'Erreur lors de la mise à jour' }
  }
}

export async function deleteFactureAction(id: string) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    await query('DELETE FROM factures WHERE id = $1 AND user_id = $2', [id, userId])

    revalidatePath('/factures')
    return { success: true }
  } catch (error) {
    console.error('Erreur suppression:', error)
    return { error: 'Erreur lors de la suppression' }
  }
}

export async function marquerFacturePayeeAction(id: string, datePaiement: string) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    const result = await query(
      `UPDATE factures SET statut = 'payee', date_paiement = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
      [datePaiement, id, userId]
    )

    if (result.rows.length === 0) {
      return { error: 'Facture introuvable' }
    }

    revalidatePath('/factures')
    revalidatePath(`/factures/${id}`)
    return { success: true, data: result.rows[0] }
  } catch (error) {
    console.error('Erreur:', error)
    return { error: 'Erreur lors du marquage comme payée' }
  }
}

export async function changerStatutFactureAction(id: string, statut: string) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    const result = await query(
      'UPDATE factures SET statut = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [statut, id, userId]
    )

    if (result.rows.length === 0) {
      return { error: 'Facture introuvable' }
    }

    revalidatePath('/factures')
    revalidatePath(`/factures/${id}`)
    return { success: true, data: result.rows[0] }
  } catch (error) {
    console.error('Erreur:', error)
    return { error: 'Erreur lors du changement de statut' }
  }
}

export async function envoyerFactureEmailAction(factureId: string) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return { error: 'Non authentifié' }
    }

    const userId = session.user.id

    // Récupérer la facture avec les relations
    const factureResult = await query(
      `SELECT f.*,
        json_build_object(
          'id', c.id, 'nom', c.nom, 'prenom', c.prenom,
          'type_client', c.type_client, 'cin', c.cin, 'adresse', c.adresse,
          'telephone', c.telephone, 'email', c.email
        ) as clients
      FROM factures f
      LEFT JOIN clients c ON f.client_id = c.id
      WHERE f.id = $1 AND f.user_id = $2`,
      [factureId, userId]
    )

    if (factureResult.rows.length === 0) {
      return { error: 'Facture non trouvée' }
    }

    const facture = factureResult.rows[0]

    // Vérifier que le client a un email
    if (!facture.clients?.email) {
      return { error: 'Le client n\'a pas d\'adresse email' }
    }

    // Récupérer le profil de l'avocat
    const profileResult = await query(
      'SELECT * FROM profiles WHERE id = $1',
      [userId]
    )

    if (profileResult.rows.length === 0) {
      return { error: 'Profil avocat non trouvé' }
    }

    const profile = profileResult.rows[0]

    // Préparer les données pour le PDF
    const pdfData = {
      facture: {
        id: facture.id,
        numero_facture: facture.numero_facture,
        date_emission: facture.date_emission,
        date_echeance: facture.date_echeance,
        date_paiement: facture.date_paiement,
        montant_ht: parseFloat(facture.montant_ht),
        taux_tva: parseFloat(facture.taux_tva),
        montant_tva: parseFloat(facture.montant_tva),
        montant_ttc: parseFloat(facture.montant_ttc),
        statut: facture.statut,
        objet: facture.objet,
        notes: facture.notes,
      },
      client: {
        nom: facture.clients.nom,
        prenom: facture.clients.prenom,
        type_client: facture.clients.type_client,
        cin: facture.clients.cin,
        adresse: facture.clients.adresse,
        telephone: facture.clients.telephone,
        email: facture.clients.email,
      },
      avocat: {
        nom: profile.nom,
        prenom: profile.prenom,
        email: profile.email,
        telephone: profile.telephone,
        matricule_avocat: profile.matricule_avocat,
        barreau: profile.barreau,
      },
      cabinet: {
        nom: profile.cabinet_nom,
        logo_url: profile.logo_url,
        rne: profile.rne,
      },
      langue: 'fr' as const,
    }

    // Générer le PDF
    const pdfBuffer = await renderToBuffer(React.createElement(FacturePDF, pdfData) as any)

    // Préparer les données email
    const clientNom =
      facture.clients.type_client === 'personne_physique'
        ? `${facture.clients.nom} ${facture.clients.prenom || ''}`.trim()
        : facture.clients.nom

    const avocatNom = `${profile.prenom || ''} ${profile.nom}`.trim()

    const formatDate = (dateString: string) => {
      const date = new Date(dateString)
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    }

    const emailData = {
      factureNumero: facture.numero_facture,
      clientNom,
      montantTTC: `${parseFloat(facture.montant_ttc).toFixed(3)} TND`,
      dateEmission: formatDate(facture.date_emission),
      dateEcheance: facture.date_echeance ? formatDate(facture.date_echeance) : undefined,
      avocatNom,
      avocatEmail: profile.email,
      avocatTelephone: profile.telephone,
      langue: 'fr' as const,
    }

    // Envoyer l'email avec Resend
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: `${avocatNom} <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`,
      to: [facture.clients.email],
      subject: `Facture ${facture.numero_facture}`,
      react: React.createElement(FactureEmailTemplate, emailData),
      text: FactureEmailText(emailData),
      attachments: [
        {
          filename: `facture-${facture.numero_facture}.pdf`,
          content: pdfBuffer,
        },
      ],
    })

    if (emailError) {
      console.error('Erreur envoi email:', emailError)
      return { error: 'Erreur lors de l\'envoi de l\'email' }
    }

    // Mettre à jour le statut de la facture si elle était en brouillon
    if (facture.statut === 'brouillon') {
      await query(
        `UPDATE factures SET statut = 'envoyee' WHERE id = $1 AND user_id = $2`,
        [factureId, userId]
      )
    }

    revalidatePath('/factures')
    revalidatePath(`/factures/${factureId}`)

    return {
      success: true,
      message: `Email envoyé à ${facture.clients.email}`,
      emailId: emailResult?.id,
    }
  } catch (error) {
    console.error('Erreur envoi facture email:', error)
    return { error: 'Erreur lors de l\'envoi de l\'email' }
  }
}
