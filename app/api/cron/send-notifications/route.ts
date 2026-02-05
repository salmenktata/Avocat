/**
 * Cron Job: Envoi Notifications Quotidiennes
 *
 * Remplace l'Edge Function Supabase pour les notifications quotidiennes.
 * Appelé par pg_cron depuis PostgreSQL (via pg_net extension).
 *
 * Endpoint protégé par CRON_SECRET pour empêcher abus.
 */

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db/postgres'
import {
  notifyDocumentAutoAttached,
  notifyDocumentPendingClassification,
  notifyDocumentUnknownNumber,
  formatFileSize,
} from '@/lib/email/notifications'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/send-notifications
 *
 * Traite toutes les notifications en attente et envoie les emails.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Vérifier authentification CRON_SECRET
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (!authHeader || authHeader !== expectedAuth) {
      console.error('❌ Cron: Authentification invalide')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('🔔 Cron: Début envoi notifications quotidiennes')

    // Récupérer tous les utilisateurs avec email
    const usersResult = await query(`
      SELECT id, email, prenom, nom
      FROM users
      WHERE email IS NOT NULL
        AND deleted_at IS NULL
    `)

    const users = usersResult.rows

    if (users.length === 0) {
      console.log('ℹ️ Cron: Aucun utilisateur à notifier')
      return NextResponse.json({
        success: true,
        message: 'Aucun utilisateur à notifier',
        duration: `${Date.now() - startTime}ms`,
      })
    }

    let totalSent = 0
    let totalErrors = 0

    // Pour chaque utilisateur
    for (const user of users) {
      const userId = user.id
      const userEmail = user.email
      const userName = user.prenom && user.nom
        ? `${user.prenom} ${user.nom}`
        : user.email

      try {
        // 1. Documents auto-attachés (dernières 24h)
        const autoAttachedDocs = await query(`
          SELECT
            d.id,
            d.nom as document_name,
            d.taille as document_size,
            d.created_at,
            c.nom as client_name,
            c.telephone as client_phone,
            dos.numero as dossier_numero,
            dos.objet as dossier_objet,
            dos.id as dossier_id
          FROM documents d
          INNER JOIN dossiers dos ON d.dossier_id = dos.id
          INNER JOIN clients c ON dos.client_id = c.id
          WHERE d.user_id = $1
            AND d.source = 'whatsapp'
            AND d.created_at > NOW() - INTERVAL '24 hours'
            AND d.notification_sent = false
        `, [userId])

        for (const doc of autoAttachedDocs.rows) {
          const result = await notifyDocumentAutoAttached({
            lawyerEmail: userEmail,
            lawyerName: userName,
            clientName: doc.client_name,
            clientPhone: doc.client_phone,
            documentName: doc.document_name,
            documentSize: formatFileSize(doc.document_size),
            dossierNumero: doc.dossier_numero,
            dossierObjet: doc.dossier_objet,
            dossierId: doc.dossier_id,
            receivedAt: new Date(doc.created_at),
          })

          if (result.success) {
            // Marquer comme notifié
            await query(
              'UPDATE documents SET notification_sent = true WHERE id = $1',
              [doc.id]
            )
            totalSent++
          } else {
            totalErrors++
          }
        }

        // 2. Documents en attente de classification (pending_documents)
        const pendingDocs = await query(`
          SELECT
            pd.id,
            pd.nom as document_name,
            pd.taille as document_size,
            pd.created_at,
            c.nom as client_name,
            c.telephone as client_phone,
            (SELECT COUNT(*) FROM dossiers WHERE client_id = c.id AND deleted_at IS NULL) as nombre_dossiers
          FROM pending_documents pd
          INNER JOIN clients c ON pd.client_id = c.id
          WHERE pd.user_id = $1
            AND pd.status = 'pending'
            AND pd.created_at > NOW() - INTERVAL '24 hours'
            AND pd.notification_sent = false
        `, [userId])

        for (const doc of pendingDocs.rows) {
          const result = await notifyDocumentPendingClassification({
            lawyerEmail: userEmail,
            lawyerName: userName,
            clientName: doc.client_name,
            clientPhone: doc.client_phone,
            documentName: doc.document_name,
            documentSize: formatFileSize(doc.document_size),
            nombreDossiers: doc.nombre_dossiers,
            receivedAt: new Date(doc.created_at),
          })

          if (result.success) {
            await query(
              'UPDATE pending_documents SET notification_sent = true WHERE id = $1',
              [doc.id]
            )
            totalSent++
          } else {
            totalErrors++
          }
        }

        // 3. Documents de numéros inconnus
        const unknownDocs = await query(`
          SELECT
            id,
            nom as document_name,
            taille as document_size,
            sender_phone,
            sender_name,
            created_at
          FROM pending_documents
          WHERE user_id = $1
            AND client_id IS NULL
            AND status = 'unknown_sender'
            AND created_at > NOW() - INTERVAL '24 hours'
            AND notification_sent = false
        `, [userId])

        for (const doc of unknownDocs.rows) {
          const result = await notifyDocumentUnknownNumber({
            lawyerEmail: userEmail,
            lawyerName: userName,
            senderPhone: doc.sender_phone,
            senderName: doc.sender_name,
            documentName: doc.document_name,
            documentSize: formatFileSize(doc.document_size),
            receivedAt: new Date(doc.created_at),
          })

          if (result.success) {
            await query(
              'UPDATE pending_documents SET notification_sent = true WHERE id = $1',
              [doc.id]
            )
            totalSent++
          } else {
            totalErrors++
          }
        }

        console.log(`✅ Cron: Notifications pour ${userEmail}: ${totalSent} envoyées`)
      } catch (error) {
        console.error(`❌ Cron: Erreur traitement user ${userId}:`, error)
        totalErrors++
      }
    }

    const duration = Date.now() - startTime

    console.log(`🔔 Cron: Terminé - ${totalSent} emails envoyés, ${totalErrors} erreurs (${duration}ms)`)

    return NextResponse.json({
      success: true,
      sent: totalSent,
      errors: totalErrors,
      users: users.length,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const duration = Date.now() - startTime

    console.error('❌ Cron: Erreur critique:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/cron/send-notifications
 *
 * Endpoint de test (désactivé en production)
 */
export async function GET(request: NextRequest) {
  // Désactiver en production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Method not allowed in production' },
      { status: 405 }
    )
  }

  // En dev, permettre test manuel
  return POST(request)
}
