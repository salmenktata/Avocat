/**
 * API Endpoint: Taxonomie juridique
 *
 * GET /api/taxonomy?type=tribunal|chambre|domain|document_type
 *
 * Retourne les options de taxonomie pour les filtres juridiques
 * Cache: 1 heure (données statiques)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/postgres'
import { getCacheHeaders, CACHE_PRESETS } from '@/lib/api/cache-headers'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')

    if (!type) {
      return NextResponse.json(
        { error: 'Paramètre "type" requis' },
        { status: 400 }
      )
    }

    // Valider le type (DB utilise 'chamber' pas 'chambre')
    const validTypes = ['tribunal', 'chamber', 'domain', 'document_type', 'category']
    // Accepter 'chambre' comme alias de 'chamber' pour compatibilité
    const dbType = type === 'chambre' ? 'chamber' : type
    if (!validTypes.includes(dbType)) {
      return NextResponse.json(
        { error: `Type invalide. Types valides: tribunal, chambre, domain, document_type, category` },
        { status: 400 }
      )
    }

    // Récupérer les options depuis la table legal_taxonomy
    // Colonnes DB: label_fr, label_ar, description (pas description_fr/description_ar)
    // Colonne DB: is_active (pas active)
    const query = `
      SELECT
        code,
        label_fr,
        label_ar,
        description
      FROM legal_taxonomy
      WHERE type = $1 AND is_active = true
      ORDER BY sort_order ASC, label_fr ASC
    `

    const result = await db.query(query, [dbType])

    const items = result.rows.map((row) => ({
      code: row.code,
      labelFr: row.label_fr,
      labelAr: row.label_ar,
      description: row.description || null,
    }))

    return NextResponse.json({
      type,
      items,
      count: items.length,
    }, {
      headers: getCacheHeaders(CACHE_PRESETS.LONG) // Cache 1 heure
    })
  } catch (error) {
    console.error('[API Taxonomy] Erreur:', error)
    return NextResponse.json(
      {
        error: 'Erreur serveur',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
