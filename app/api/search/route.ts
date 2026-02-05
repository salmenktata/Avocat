import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface SearchResult {
  id: string
  type: 'client' | 'dossier' | 'facture' | 'document'
  title: string
  subtitle?: string
  url: string
  icon: string
  badge?: {
    text: string
    variant: 'default' | 'success' | 'warning' | 'destructive'
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ results: [] })
    }

    const supabase = await createClient()

    // Vérifier l'authentification
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchTerm = `%${query.trim()}%`
    const results: SearchResult[] = []

    // Rechercher dans les clients
    const { data: clients } = await supabase
      .from('clients')
      .select('id, nom, prenom, email, type_client, denomination')
      .or(
        `nom.ilike.${searchTerm},prenom.ilike.${searchTerm},email.ilike.${searchTerm},denomination.ilike.${searchTerm}`
      )
      .limit(5)

    if (clients) {
      clients.forEach((client) => {
        const isCompany = client.type_client === 'ENTREPRISE'
        const title = isCompany
          ? client.denomination || 'Sans nom'
          : `${client.prenom || ''} ${client.nom || ''}`.trim()

        results.push({
          id: client.id,
          type: 'client',
          title,
          subtitle: client.email,
          url: `/clients/${client.id}`,
          icon: isCompany ? 'building' : 'user',
        })
      })
    }

    // Rechercher dans les dossiers
    const { data: dossiers } = await supabase
      .from('dossiers')
      .select('id, numero_dossier, objet, statut')
      .or(`numero_dossier.ilike.${searchTerm},objet.ilike.${searchTerm}`)
      .limit(5)

    if (dossiers) {
      dossiers.forEach((dossier) => {
        let badgeVariant: 'default' | 'success' | 'warning' | 'destructive' = 'default'
        let badgeText = dossier.statut

        if (dossier.statut === 'ACTIF') {
          badgeVariant = 'success'
          badgeText = 'Actif'
        } else if (dossier.statut === 'CLOS') {
          badgeVariant = 'warning'
          badgeText = 'Clôturé'
        } else if (dossier.statut === 'ARCHIVE') {
          badgeVariant = 'default'
          badgeText = 'Archivé'
        }

        results.push({
          id: dossier.id,
          type: 'dossier',
          title: dossier.numero_dossier,
          subtitle: dossier.objet,
          url: `/dossiers/${dossier.id}`,
          icon: 'dossiers',
          badge: {
            text: badgeText,
            variant: badgeVariant,
          },
        })
      })
    }

    // Rechercher dans les factures
    const { data: factures } = await supabase
      .from('factures')
      .select('id, numero_facture, objet, statut, montant_ttc')
      .or(`numero_facture.ilike.${searchTerm},objet.ilike.${searchTerm}`)
      .limit(5)

    if (factures) {
      factures.forEach((facture) => {
        let badgeVariant: 'default' | 'success' | 'warning' | 'destructive' = 'default'
        let badgeText = facture.statut

        if (facture.statut === 'PAYEE') {
          badgeVariant = 'success'
          badgeText = 'Payée'
        } else if (facture.statut === 'ENVOYEE') {
          badgeVariant = 'default'
          badgeText = 'Envoyée'
        } else if (facture.statut === 'IMPAYEE') {
          badgeVariant = 'destructive'
          badgeText = 'Impayée'
        } else if (facture.statut === 'BROUILLON') {
          badgeVariant = 'default'
          badgeText = 'Brouillon'
        }

        const montant = facture.montant_ttc
          ? `${facture.montant_ttc.toFixed(3)} TND`
          : ''

        results.push({
          id: facture.id,
          type: 'facture',
          title: facture.numero_facture || `Facture ${facture.id.substring(0, 8)}`,
          subtitle: `${facture.objet}${montant ? ` • ${montant}` : ''}`,
          url: `/factures/${facture.id}`,
          icon: 'invoices',
          badge: {
            text: badgeText,
            variant: badgeVariant,
          },
        })
      })
    }

    // Rechercher dans les documents
    const { data: documents } = await supabase
      .from('documents')
      .select('id, nom, type_fichier')
      .ilike('nom', searchTerm)
      .limit(5)

    if (documents) {
      documents.forEach((doc) => {
        results.push({
          id: doc.id,
          type: 'document',
          title: doc.nom,
          subtitle: doc.type_fichier || 'Document',
          url: `/documents?id=${doc.id}`,
          icon: 'documents',
        })
      })
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
