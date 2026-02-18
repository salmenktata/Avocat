import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { query } from '@/lib/db/postgres'

export async function GET() {
  const session = await getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const result = await query<{ category: string; count: string }>(
    `SELECT category, COUNT(*)::text as count
     FROM knowledge_base
     WHERE is_indexed = true AND is_active = true
     GROUP BY category
     ORDER BY count DESC`
  )

  const byCategory: Record<string, number> = {}
  let totalDocuments = 0

  for (const row of result.rows) {
    const count = parseInt(row.count, 10)
    byCategory[row.category] = count
    totalDocuments += count
  }

  return NextResponse.json(
    { totalDocuments, byCategory },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' } }
  )
}
