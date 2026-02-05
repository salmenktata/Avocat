'use server'

import { query } from '@/lib/db/postgres'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import {
  templateSchema,
  type TemplateFormData,
  generateDocumentSchema,
  type GenerateDocumentData,
} from '@/lib/validations/template'

/**
 * Récupérer tous les templates (propres + publics)
 */
export async function getTemplatesAction() {
  const session = await getSession()
  if (!session?.user?.id) {
    return { error: 'Non authentifié' }
  }

  const userId = session.user.id

  const result = await query(
    'SELECT * FROM templates WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  )

  return { templates: result.rows }
}

/**
 * Récupérer un template par ID
 */
export async function getTemplateByIdAction(id: string) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { error: 'Non authentifié' }
  }

  const userId = session.user.id

  const result = await query(
    'SELECT * FROM templates WHERE id = $1 AND user_id = $2',
    [id, userId]
  )

  if (result.rows.length === 0) {
    return { error: 'Template introuvable' }
  }

  return { template: result.rows[0] }
}

/**
 * Créer un nouveau template
 */
export async function createTemplateAction(formData: TemplateFormData) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { error: 'Non authentifié' }
  }

  const userId = session.user.id

  // Valider les données
  const validatedData = templateSchema.parse(formData)

  // Extraire les variables du contenu (recherche {{variable}})
  const variablesFromContent = extractVariables(validatedData.contenu)

  const data = {
    user_id: userId,
    ...validatedData,
    variables: variablesFromContent,
  }

  const columns = Object.keys(data).join(', ')
  const values = Object.values(data)
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')

  const result = await query(
    `INSERT INTO templates (${columns}) VALUES (${placeholders}) RETURNING *`,
    values
  )

  revalidatePath('/templates')
  return { template: result.rows[0] }
}

/**
 * Mettre à jour un template
 */
export async function updateTemplateAction(id: string, formData: TemplateFormData) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { error: 'Non authentifié' }
  }

  const userId = session.user.id

  // Valider les données
  const validatedData = templateSchema.parse(formData)

  // Extraire les variables du contenu
  const variablesFromContent = extractVariables(validatedData.contenu)

  const updateData = {
    ...validatedData,
    variables: variablesFromContent,
  }

  const setClause = Object.keys(updateData)
    .map((key, i) => `${key} = $${i + 1}`)
    .join(', ')
  const values = [...Object.values(updateData), id, userId]

  const result = await query(
    `UPDATE templates SET ${setClause} WHERE id = $${values.length - 1} AND user_id = $${values.length} RETURNING *`,
    values
  )

  if (result.rows.length === 0) {
    return { error: 'Template introuvable' }
  }

  revalidatePath('/templates')
  revalidatePath(`/templates/${id}`)
  return { template: result.rows[0] }
}

/**
 * Supprimer un template
 */
export async function deleteTemplateAction(id: string) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { error: 'Non authentifié' }
  }

  const userId = session.user.id

  await query('DELETE FROM templates WHERE id = $1 AND user_id = $2', [id, userId])

  revalidatePath('/templates')
  return { success: true }
}

/**
 * Générer un document à partir d'un template
 */
export async function generateDocumentAction(data: GenerateDocumentData) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { error: 'Non authentifié' }
  }

  const userId = session.user.id

  // Valider les données
  const validatedData = generateDocumentSchema.parse(data)

  // Récupérer le template
  const templateResult = await query(
    'SELECT * FROM templates WHERE id = $1 AND user_id = $2',
    [validatedData.template_id, userId]
  )

  if (templateResult.rows.length === 0) {
    return { error: 'Template introuvable' }
  }

  const template = templateResult.rows[0]

  // Récupérer le dossier avec client
  const dossierResult = await query(
    `SELECT d.*, json_build_object(
      'id', c.id, 'nom', c.nom, 'prenom', c.prenom,
      'type_client', c.type_client, 'cin', c.cin, 'adresse', c.adresse,
      'telephone', c.telephone, 'email', c.email
    ) as clients
    FROM dossiers d
    LEFT JOIN clients c ON d.client_id = c.id
    WHERE d.id = $1 AND d.user_id = $2`,
    [validatedData.dossier_id, userId]
  )

  if (dossierResult.rows.length === 0) {
    return { error: 'Dossier introuvable' }
  }

  const dossier = dossierResult.rows[0]

  // Remplacer les variables dans le contenu
  let contenuGenere = template.contenu

  // Parcourir toutes les variables fournies
  for (const [key, value] of Object.entries(validatedData.variables_values)) {
    const regex = new RegExp(`{{${key}}}`, 'g')
    contenuGenere = contenuGenere.replace(regex, value)
  }

  // Incrémenter le compteur d'utilisations
  await query(
    'UPDATE templates SET nombre_utilisations = $1 WHERE id = $2',
    [(template.nombre_utilisations || 0) + 1, template.id]
  )

  return {
    success: true,
    contenu: contenuGenere,
    template_titre: template.titre,
    variables_manquantes: extractVariables(contenuGenere), // Variables non remplacées
  }
}

/**
 * Dupliquer un template
 */
export async function duplicateTemplateAction(id: string) {
  const session = await getSession()
  if (!session?.user?.id) {
    return { error: 'Non authentifié' }
  }

  const userId = session.user.id

  // Récupérer le template original
  const originalResult = await query(
    'SELECT * FROM templates WHERE id = $1 AND user_id = $2',
    [id, userId]
  )

  if (originalResult.rows.length === 0) {
    return { error: 'Template introuvable' }
  }

  const original = originalResult.rows[0]

  // Créer une copie
  const result = await query(
    `INSERT INTO templates (user_id, titre, description, type_document, contenu, variables, est_public)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      userId,
      `${original.titre} (copie)`,
      original.description,
      original.type_document,
      original.contenu,
      original.variables,
      false,
    ]
  )

  revalidatePath('/templates')
  return { template: result.rows[0] }
}

/**
 * Extraire les variables d'un contenu (format {{variable}})
 */
function extractVariables(contenu: string): string[] {
  const regex = /{{([^}]+)}}/g
  const variables: string[] = []
  let match

  while ((match = regex.exec(contenu)) !== null) {
    variables.push(match[1])
  }

  // Retourner les variables uniques
  return [...new Set(variables)]
}
