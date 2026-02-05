'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createStorageManager } from '@/lib/integrations/storage-manager'
import { createGoogleDriveProvider } from '@/lib/integrations/cloud-storage'

interface DossierWithUserId {
  user_id: string
}

/**
 * Upload document vers Google Drive via Storage Manager
 */
export async function uploadDocumentAction(formData: FormData) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Non authentifié' }
    }

    // Extraire les données du formulaire
    const file = formData.get('file') as File
    const dossierId = formData.get('dossier_id') as string
    const categorie = formData.get('categorie') as string
    const description = formData.get('description') as string

    if (!file) {
      return { error: 'Aucun fichier fourni' }
    }

    if (!dossierId) {
      return { error: 'Dossier non spécifié' }
    }

    // Vérifier que le dossier appartient à l'utilisateur
    const { data: dossier, error: dossierError } = await supabase
      .from('dossiers')
      .select('id')
      .eq('id', dossierId)
      .eq('user_id', user.id)
      .single()

    if (dossierError || !dossier) {
      return { error: 'Dossier introuvable ou accès refusé' }
    }

    // Vérifier que Google Drive est connecté
    const { data: cloudConfig } = await supabase
      .from('cloud_providers_config')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'google_drive')
      .eq('enabled', true)
      .single()

    if (!cloudConfig) {
      return {
        error: 'Google Drive non connecté. Veuillez configurer le stockage cloud dans les paramètres.',
      }
    }

    // Convertir File en Buffer
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    // Uploader via Storage Manager
    const storageManager = createStorageManager()
    const uploadResult = await storageManager.uploadDocument({
      userId: user.id,
      dossierId: dossierId,
      fileName: file.name,
      fileBuffer: fileBuffer,
      mimeType: file.type || 'application/octet-stream',
      categorie: categorie || undefined,
      description: description || undefined,
      sourceType: 'manual',
    })

    if (!uploadResult.success) {
      return { error: 'Erreur lors de l\'upload du fichier vers Google Drive' }
    }

    // Récupérer le document créé
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', uploadResult.documentId)
      .single()

    if (fetchError || !document) {
      console.error('Erreur récupération document:', fetchError)
      return { error: 'Document uploadé mais erreur lors de la récupération' }
    }

    revalidatePath('/dossiers')
    revalidatePath(`/dossiers/${dossierId}`)
    return { success: true, data: document }
  } catch (error: any) {
    console.error('Erreur upload:', error)

    // Messages d'erreur spécifiques
    if (error.code === 'TOKEN_EXPIRED') {
      return {
        error: 'Token Google Drive expiré. Veuillez vous reconnecter dans les paramètres.',
      }
    }

    if (error.code === 'QUOTA_EXCEEDED') {
      return {
        error: 'Quota Google Drive dépassé. Veuillez libérer de l\'espace sur votre Drive.',
      }
    }

    if (error.code === 'CONFIG_NOT_FOUND') {
      return {
        error: 'Configuration Google Drive non trouvée. Veuillez reconnecter votre compte.',
      }
    }

    return {
      error: error.message || 'Une erreur est survenue lors de l\'upload',
    }
  }
}

/**
 * Supprimer document de Google Drive et de la BDD
 */
export async function deleteDocumentAction(id: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Non authentifié' }
    }

    // Récupérer le document avec infos cloud
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('*, dossiers!inner(user_id)')
      .eq('id', id)
      .single()

    if (fetchError || !document) {
      return { error: 'Document introuvable' }
    }

    if ((document.dossiers as DossierWithUserId).user_id !== user.id) {
      return { error: 'Accès refusé' }
    }

    // Si document stocké sur Google Drive
    if (document.storage_provider === 'google_drive' && document.external_file_id) {
      try {
        // Récupérer config cloud
        const { data: cloudConfig } = await supabase
          .from('cloud_providers_config')
          .select('access_token')
          .eq('user_id', user.id)
          .eq('provider', 'google_drive')
          .eq('enabled', true)
          .single()

        if (cloudConfig) {
          // Supprimer de Google Drive
          const provider = createGoogleDriveProvider(cloudConfig.access_token)
          await provider.deleteFile({
            fileId: document.external_file_id,
          })

          console.log(`[deleteDocumentAction] Fichier supprimé de Google Drive: ${document.external_file_id}`)
        } else {
          console.warn('[deleteDocumentAction] Config Google Drive non trouvée, suppression BDD uniquement')
        }
      } catch (error: any) {
        console.error('[deleteDocumentAction] Erreur suppression Google Drive:', error)
        // Continue quand même pour supprimer l'entrée en base
        // (le fichier peut déjà être supprimé manuellement de Drive)
      }
    }

    // Supprimer l'entrée de la base de données
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Erreur suppression document BDD:', deleteError)
      return { error: 'Erreur lors de la suppression du document' }
    }

    revalidatePath('/dossiers')
    revalidatePath(`/dossiers/${document.dossier_id}`)
    return { success: true }
  } catch (error) {
    console.error('Erreur suppression:', error)
    return { error: 'Erreur lors de la suppression du document' }
  }
}

/**
 * Obtenir URL document Google Drive (lien partageable)
 */
export async function getDocumentUrlAction(id: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Non authentifié' }
    }

    // Récupérer le document
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('*, dossiers!inner(user_id)')
      .eq('id', id)
      .single()

    if (fetchError || !document) {
      return { error: 'Document introuvable' }
    }

    if ((document.dossiers as DossierWithUserId).user_id !== user.id) {
      return { error: 'Accès refusé' }
    }

    // Si document sur Google Drive, retourner lien partageable
    if (document.storage_provider === 'google_drive' && document.external_sharing_link) {
      return {
        success: true,
        url: document.external_sharing_link,
        provider: 'google_drive',
      }
    }

    // Si document legacy sur Supabase Storage (pour rétrocompatibilité)
    if (document.storage_path) {
      console.warn('[getDocumentUrlAction] Document legacy sur Supabase Storage:', id)
      return {
        error: 'Document legacy non accessible. Veuillez re-uploader le document.',
      }
    }

    return { error: 'URL document non disponible' }
  } catch (error) {
    console.error('Erreur récupération URL:', error)
    return { error: 'Erreur lors de la récupération de l\'URL' }
  }
}

/**
 * Mettre à jour métadonnées document (catégorie, description)
 */
export async function updateDocumentAction(
  id: string,
  data: { categorie?: string; description?: string }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Non authentifié' }
    }

    // Vérifier que le document appartient à l'utilisateur
    const { data: document, error: checkError } = await supabase
      .from('documents')
      .select('dossier_id, dossiers!inner(user_id)')
      .eq('id', id)
      .single()

    if (
      checkError ||
      !document ||
      (document.dossiers as unknown as DossierWithUserId).user_id !== user.id
    ) {
      return { error: 'Document introuvable ou accès refusé' }
    }

    const { data: updated, error } = await supabase
      .from('documents')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Erreur mise à jour document:', error)
      return { error: 'Erreur lors de la mise à jour du document' }
    }

    revalidatePath('/dossiers')
    revalidatePath(`/dossiers/${document.dossier_id}`)
    return { success: true, data: updated }
  } catch (error) {
    console.error('Erreur mise à jour:', error)
    return { error: 'Erreur lors de la mise à jour du document' }
  }
}

/**
 * Récupérer tous les documents d'un dossier
 */
export async function getDocumentsByDossierAction(dossierId: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Non authentifié' }
    }

    // Vérifier que le dossier appartient à l'utilisateur
    const { data: dossier, error: dossierError } = await supabase
      .from('dossiers')
      .select('id')
      .eq('id', dossierId)
      .eq('user_id', user.id)
      .single()

    if (dossierError || !dossier) {
      return { error: 'Dossier introuvable ou accès refusé' }
    }

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('dossier_id', dossierId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erreur récupération documents:', error)
      return { error: 'Erreur lors de la récupération des documents' }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Erreur:', error)
    return { error: 'Erreur lors de la récupération des documents' }
  }
}

/**
 * Télécharger un document depuis Google Drive
 * Retourne le fichier en tant que Buffer
 */
export async function downloadDocumentAction(id: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Non authentifié' }
    }

    // Récupérer le document
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('*, dossiers!inner(user_id)')
      .eq('id', id)
      .single()

    if (fetchError || !document) {
      return { error: 'Document introuvable' }
    }

    if ((document.dossiers as DossierWithUserId).user_id !== user.id) {
      return { error: 'Accès refusé' }
    }

    // Si document sur Google Drive
    if (document.storage_provider === 'google_drive' && document.external_file_id) {
      // Récupérer config cloud
      const { data: cloudConfig } = await supabase
        .from('cloud_providers_config')
        .select('access_token')
        .eq('user_id', user.id)
        .eq('provider', 'google_drive')
        .eq('enabled', true)
        .single()

      if (!cloudConfig) {
        return { error: 'Configuration Google Drive non trouvée' }
      }

      // Télécharger depuis Google Drive
      const provider = createGoogleDriveProvider(cloudConfig.access_token)
      const downloadResult = await provider.downloadFile({
        fileId: document.external_file_id,
      })

      return {
        success: true,
        buffer: downloadResult.buffer,
        fileName: downloadResult.fileName,
        mimeType: downloadResult.mimeType,
      }
    }

    return { error: 'Document non disponible pour téléchargement' }
  } catch (error: any) {
    console.error('Erreur téléchargement document:', error)

    if (error.code === 'TOKEN_EXPIRED') {
      return {
        error: 'Token Google Drive expiré. Veuillez vous reconnecter dans les paramètres.',
      }
    }

    return {
      error: error.message || 'Erreur lors du téléchargement du document',
    }
  }
}

/**
 * Récupérer documents en attente de classification (needs_classification=true)
 */
export async function getUnclassifiedDocumentsAction() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Non authentifié' }
    }

    // Récupérer documents non classés avec infos client
    const { data, error } = await supabase
      .from('documents')
      .select(
        `
        *,
        dossiers:dossier_id (
          id,
          numero_dossier,
          objet,
          client_id,
          clients:client_id (
            id,
            nom,
            prenom,
            denomination,
            type
          )
        )
      `
      )
      .eq('user_id', user.id)
      .eq('needs_classification', true)
      .is('dossier_id', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erreur récupération documents non classés:', error)
      return { error: 'Erreur lors de la récupération des documents' }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Erreur:', error)
    return { error: 'Erreur lors de la récupération des documents' }
  }
}

/**
 * Classer un document en le rattachant à un dossier
 */
export async function classifyDocumentAction(
  documentId: string,
  dossierId: string
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Non authentifié' }
    }

    // Vérifier que le document appartient à l'utilisateur
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, external_file_id, nom_fichier, user_id')
      .eq('id', documentId)
      .single()

    if (docError || !document || document.user_id !== user.id) {
      return { error: 'Document introuvable ou accès refusé' }
    }

    // Vérifier que le dossier appartient à l'utilisateur
    const { data: dossier, error: dossierError } = await supabase
      .from('dossiers')
      .select('id, numero_dossier, client_id, google_drive_folder_id')
      .eq('id', dossierId)
      .eq('user_id', user.id)
      .single()

    if (dossierError || !dossier) {
      return { error: 'Dossier introuvable ou accès refusé' }
    }

    // TODO (optionnel) : Déplacer fichier dans Google Drive vers bon dossier juridique
    // Pour l'instant, on se contente de mettre à jour la BDD

    // Mettre à jour document en BDD
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        dossier_id: dossierId,
        needs_classification: false,
        classified_at: new Date().toISOString(),
        external_folder_dossier_id: dossier.google_drive_folder_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)

    if (updateError) {
      console.error('Erreur classification document:', updateError)
      return { error: 'Erreur lors de la classification du document' }
    }

    console.log(
      `[classifyDocumentAction] Document ${document.nom_fichier} classé dans dossier ${dossier.numero_dossier}`
    )

    revalidatePath('/dashboard')
    revalidatePath(`/dossiers/${dossierId}`)

    return { success: true }
  } catch (error) {
    console.error('Erreur classification:', error)
    return { error: 'Erreur lors de la classification du document' }
  }
}

/**
 * Ignorer un document non classé (masquer de la liste)
 */
export async function ignoreUnclassifiedDocumentAction(documentId: string) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: 'Non authentifié' }
    }

    // Vérifier que le document appartient à l'utilisateur
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, user_id')
      .eq('id', documentId)
      .single()

    if (docError || !document || document.user_id !== user.id) {
      return { error: 'Document introuvable ou accès refusé' }
    }

    // Marquer comme classé mais sans dossier (pour le masquer de la liste)
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        needs_classification: false,
        classified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)

    if (updateError) {
      console.error('Erreur ignorer document:', updateError)
      return { error: 'Erreur lors de l\'opération' }
    }

    console.log(`[ignoreUnclassifiedDocumentAction] Document ignoré: ${documentId}`)

    revalidatePath('/dashboard')

    return { success: true }
  } catch (error) {
    console.error('Erreur ignorer:', error)
    return { error: 'Erreur lors de l\'opération' }
  }
}
