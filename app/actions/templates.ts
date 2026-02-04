'use server'

import { createClient } from '@/lib/supabase/server'
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
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Non authentifié' }
  }

  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Erreur récupération templates:', error)
    return { error: error.message }
  }

  return { templates: data }
}

/**
 * Récupérer un template par ID
 */
export async function getTemplateByIdAction(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Non authentifié' }
  }

  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Erreur récupération template:', error)
    return { error: error.message }
  }

  return { template: data }
}

/**
 * Créer un nouveau template
 */
export async function createTemplateAction(formData: TemplateFormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Non authentifié' }
  }

  // Valider les données
  const validatedData = templateSchema.parse(formData)

  // Extraire les variables du contenu (recherche {{variable}})
  const variablesFromContent = extractVariables(validatedData.contenu)

  const { data, error } = await supabase
    .from('templates')
    .insert({
      user_id: user.id,
      ...validatedData,
      variables: variablesFromContent,
    })
    .select()
    .single()

  if (error) {
    console.error('Erreur création template:', error)
    return { error: error.message }
  }

  revalidatePath('/templates')
  return { template: data }
}

/**
 * Mettre à jour un template
 */
export async function updateTemplateAction(id: string, formData: TemplateFormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Non authentifié' }
  }

  // Valider les données
  const validatedData = templateSchema.parse(formData)

  // Extraire les variables du contenu
  const variablesFromContent = extractVariables(validatedData.contenu)

  const { data, error } = await supabase
    .from('templates')
    .update({
      ...validatedData,
      variables: variablesFromContent,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Erreur mise à jour template:', error)
    return { error: error.message }
  }

  revalidatePath('/templates')
  revalidatePath(`/templates/${id}`)
  return { template: data }
}

/**
 * Supprimer un template
 */
export async function deleteTemplateAction(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Non authentifié' }
  }

  const { error } = await supabase.from('templates').delete().eq('id', id)

  if (error) {
    console.error('Erreur suppression template:', error)
    return { error: error.message }
  }

  revalidatePath('/templates')
  return { success: true }
}

/**
 * Générer un document à partir d'un template
 */
export async function generateDocumentAction(data: GenerateDocumentData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Non authentifié' }
  }

  // Valider les données
  const validatedData = generateDocumentSchema.parse(data)

  // Récupérer le template
  const { data: template, error: templateError } = await supabase
    .from('templates')
    .select('*')
    .eq('id', validatedData.template_id)
    .single()

  if (templateError || !template) {
    return { error: 'Template introuvable' }
  }

  // Récupérer le dossier
  const { data: dossier, error: dossierError } = await supabase
    .from('dossiers')
    .select('*, clients(*)')
    .eq('id', validatedData.dossier_id)
    .single()

  if (dossierError || !dossier) {
    return { error: 'Dossier introuvable' }
  }

  // Remplacer les variables dans le contenu
  let contenuGenere = template.contenu

  // Parcourir toutes les variables fournies
  for (const [key, value] of Object.entries(validatedData.variables_values)) {
    const regex = new RegExp(`{{${key}}}`, 'g')
    contenuGenere = contenuGenere.replace(regex, value)
  }

  // Incrémenter le compteur d'utilisations
  await supabase
    .from('templates')
    .update({ nombre_utilisations: (template.nombre_utilisations || 0) + 1 })
    .eq('id', template.id)

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
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Non authentifié' }
  }

  // Récupérer le template original
  const { data: original, error: fetchError } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !original) {
    return { error: 'Template introuvable' }
  }

  // Créer une copie
  const { data, error } = await supabase
    .from('templates')
    .insert({
      user_id: user.id,
      titre: `${original.titre} (copie)`,
      description: original.description,
      type_document: original.type_document,
      contenu: original.contenu,
      variables: original.variables,
      est_public: false, // Ne pas dupliquer en public
    })
    .select()
    .single()

  if (error) {
    console.error('Erreur duplication template:', error)
    return { error: error.message }
  }

  revalidatePath('/templates')
  return { template: data }
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
