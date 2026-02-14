import { NextResponse } from 'next/server';

/**
 * Route API de test pour validation déploiement Tier 1
 *
 * Cette route permet de vérifier que les nouvelles routes API
 * sont correctement compilées et déployées via Lightning Deploy (Tier 1).
 *
 * Fix: Semaine 1 - Suppression complète de .next/server avant docker cp
 *
 * Test: curl https://qadhya.tn/api/test-deploy
 * Attendu: {"status":"ok","message":"Test deploy route works","timestamp":"..."}
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Test deploy route works',
    timestamp: new Date().toISOString(),
    deployment: {
      tier: 'lightning',
      week: 1,
      fix: 'Complete .next/server removal',
    },
  });
}
