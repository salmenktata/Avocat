import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')

    if (!query || query.length < 2) {
      return NextResponse.json({ results: { clients: [], dossiers: [], factures: [], documents: [] } })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const searchTerm = query.trim()

    const [clients, dossiers, factures, documents] = await Promise.all([
      supabase.from('clients').select('id, nom, prenom, denomination, type').eq('user_id', user.id).or(`nom.ilike.%${searchTerm}%,prenom.ilike.%${searchTerm}%,denomination.ilike.%${searchTerm}%`).limit(5),
      supabase.from('dossiers').select('id, numero_dossier, objet, statut').eq('user_id', user.id).or(`numero_dossier.ilike.%${searchTerm}%,objet.ilike.%${searchTerm}%`).limit(5),
      supabase.from('factures').select('id, numero_facture, objet, montant_ttc, statut').eq('user_id', user.id).or(`numero_facture.ilike.%${searchTerm}%`).limit(5),
      supabase.from('documents').select('id, nom_fichier, type_document').eq('user_id', user.id).ilike('nom_fichier', `%${searchTerm}%`).limit(5)
    ])

    return NextResponse.json({
      results: {
        clients: clients.data || [],
        dossiers: dossiers.data || [],
        factures: factures.data || [],
        documents: documents.data || []
      }
    })
  } catch (error) {
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
