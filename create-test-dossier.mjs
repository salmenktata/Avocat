import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function createTestDossier() {
  console.log('📁 Création d\'un dossier de test...\n')

  // Connexion
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test@avocat.tn',
    password: 'Test123456!',
  })

  if (authError) {
    console.error('❌ Erreur connexion:', authError.message)
    return
  }

  console.log('✅ Connecté:', authData.user.email)

  // Récupérer un client
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', authData.user.id)
    .limit(1)

  if (!clients || clients.length === 0) {
    console.error('❌ Aucun client trouvé')
    return
  }

  const client = clients[0]

  // Créer un dossier
  const dossierData = {
    user_id: authData.user.id,
    client_id: client.id,
    numero_dossier: `DOS${Date.now()}`,
    type_procedure: 'civil',
    objet: 'Litige commercial - Test',
    description: 'Dossier de test pour démonstration échéances',
    tribunal: 'Tribunal de Première Instance de Tunis',
    statut: 'ACTIF',
    workflow_etape_actuelle: 'ASSIGNATION',
  }

  const { data: dossier, error: dossierError } = await supabase
    .from('dossiers')
    .insert(dossierData)
    .select()
    .single()

  if (dossierError) {
    console.error('❌ Erreur création dossier:', dossierError.message)
    return
  }

  console.log('✅ Dossier créé:', dossier.numero_dossier)
  console.log('   - Client:', client.nom, client.prenom)
  console.log('   - Type:', dossier.type_procedure)
  console.log('   - Tribunal:', dossier.tribunal)
  console.log('\nVous pouvez maintenant exécuter: node test-echeances.mjs')
}

createTestDossier().catch(console.error)
