/**
 * API de debug pour vérifier les variables d'environnement
 * À SUPPRIMER en production !
 */
import { NextResponse } from 'next/server'

export async function GET() {
  const env = {
    GOOGLE_DRIVE_ENABLED: process.env.GOOGLE_DRIVE_ENABLED || 'non défini',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? '✓ défini' : '✗ manquant',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? '✓ défini' : '✗ manquant',
    GOOGLE_DRIVE_TEST_ACCESS_TOKEN: process.env.GOOGLE_DRIVE_TEST_ACCESS_TOKEN
      ? `✓ défini (${process.env.GOOGLE_DRIVE_TEST_ACCESS_TOKEN.substring(0, 30)}...)`
      : '✗ manquant',
    NODE_ENV: process.env.NODE_ENV,
  }

  return NextResponse.json(env)
}
