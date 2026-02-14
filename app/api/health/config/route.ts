/**
 * API Health Check - Configuration Hash & Drift Detection
 *
 * GET /api/health/config
 *
 * Retourne hash configuration actuelle (sans exposer secrets)
 * Compare avec hash attendu depuis schéma JSON
 *
 * Features:
 * - Hash SHA256 des variables CRITICAL uniquement
 * - Détection drift configuration runtime
 * - Comparaison avec hash attendu (stocké Redis)
 * - Liste variables driftées si détection
 *
 * Réponse:
 * {
 *   "configHash": "7f3a9d2e...",
 *   "criticalVars": { "RAG_ENABLED": "sha256:a1b2...", ... },
 *   "lastValidated": "2026-02-15T10:30:00Z",
 *   "expectedHash": "7f3a9d2e...",
 *   "driftDetected": false,
 *   "criticalDrift": false,
 *   "driftedVars": []
 * }
 */

import { NextResponse } from 'next/server'
import crypto from 'crypto'
import schema from '@/docs/env-schema.json'
import { redis } from '@/lib/cache/redis'

const EXPECTED_HASH_KEY = 'config:expected_hash'
const DRIFT_HISTORY_KEY = 'config:drift_history'
const DRIFT_HISTORY_TTL = 7 * 24 * 60 * 60 // 7 jours

interface CriticalVarHash {
  name: string
  hash: string
  criticality: string
}

interface DriftedVar {
  name: string
  criticality: string
  expectedHash: string
  actualHash: string
}

/**
 * Hash une valeur de manière sécurisée (ne révèle pas le secret)
 */
function hashValue(value: string | undefined): string {
  if (!value) return crypto.createHash('sha256').update('').digest('hex').slice(0, 16)

  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16)
}

/**
 * Récupère variables CRITICAL du schéma
 */
function getCriticalVariables(): Array<{ name: string; criticality: string }> {
  const allVars = schema.categories.flatMap((cat) =>
    cat.variables.map((v) => ({
      name: v.name,
      criticality: v.criticality,
    }))
  )

  return allVars.filter((v) => v.criticality === 'CRITICAL')
}

/**
 * Génère hash global configuration
 */
function generateConfigHash(varHashes: CriticalVarHash[]): string {
  // Trier par nom pour garantir ordre stable
  const sorted = [...varHashes].sort((a, b) => a.name.localeCompare(b.name))

  // Concaténer tous les hashes
  const combined = sorted.map((v) => v.hash).join('')

  // Hash global
  return crypto.createHash('sha256').update(combined).digest('hex')
}

/**
 * Détecte variables driftées
 */
async function detectDriftedVars(
  currentVars: CriticalVarHash[]
): Promise<{ driftedVars: DriftedVar[]; criticalDrift: boolean }> {
  try {
    // Récupérer hash attendu depuis Redis
    const expectedHashData = await redis.get(EXPECTED_HASH_KEY)

    if (!expectedHashData) {
      // Première exécution : stocker hash actuel comme référence
      const currentHash = generateConfigHash(currentVars)
      const varHashMap = Object.fromEntries(currentVars.map((v) => [v.name, v.hash]))

      await redis.set(
        EXPECTED_HASH_KEY,
        JSON.stringify({
          hash: currentHash,
          varHashes: varHashMap,
          timestamp: new Date().toISOString(),
        }),
        { EX: 30 * 24 * 60 * 60 } // 30 jours TTL
      )

      return { driftedVars: [], criticalDrift: false }
    }

    // Parser hash attendu
    const expected = JSON.parse(expectedHashData)
    const expectedVarHashes = expected.varHashes as Record<string, string>

    // Comparer chaque variable
    const driftedVars: DriftedVar[] = []

    for (const currentVar of currentVars) {
      const expectedHash = expectedVarHashes[currentVar.name]

      if (expectedHash && expectedHash !== currentVar.hash) {
        driftedVars.push({
          name: currentVar.name,
          criticality: currentVar.criticality,
          expectedHash,
          actualHash: currentVar.hash,
        })
      }
    }

    const criticalDrift = driftedVars.some((v) => v.criticality === 'CRITICAL')

    return { driftedVars, criticalDrift }
  } catch (error) {
    console.error('Error detecting drift:', error)
    return { driftedVars: [], criticalDrift: false }
  }
}

/**
 * Enregistre événement drift dans historique
 */
async function recordDriftEvent(driftedVars: DriftedVar[]): Promise<void> {
  if (driftedVars.length === 0) return

  try {
    const event = {
      timestamp: new Date().toISOString(),
      driftedVars: driftedVars.map((v) => ({
        name: v.name,
        criticality: v.criticality,
      })),
    }

    await redis.lPush(DRIFT_HISTORY_KEY, JSON.stringify(event))
    await redis.lTrim(DRIFT_HISTORY_KEY, 0, 99) // Garder 100 événements max
    await redis.expire(DRIFT_HISTORY_KEY, DRIFT_HISTORY_TTL)
  } catch (error) {
    console.error('Error recording drift event:', error)
  }
}

/**
 * Endpoint principal
 */
export async function GET() {
  try {
    // Récupérer variables CRITICAL
    const criticalVars = getCriticalVariables()

    // Générer hashes actuels
    const currentVarHashes: CriticalVarHash[] = criticalVars.map((v) => ({
      name: v.name,
      hash: hashValue(process.env[v.name]),
      criticality: v.criticality,
    }))

    // Hash global actuel
    const configHash = generateConfigHash(currentVarHashes)

    // Détection drift
    const { driftedVars, criticalDrift } = await detectDriftedVars(currentVarHashes)

    // Enregistrer si drift détecté
    if (driftedVars.length > 0) {
      await recordDriftEvent(driftedVars)
    }

    // Récupérer hash attendu
    let expectedHash = configHash
    try {
      const expectedData = await redis.get(EXPECTED_HASH_KEY)
      if (expectedData) {
        expectedHash = JSON.parse(expectedData).hash
      }
    } catch {
      // Utiliser hash actuel si erreur
    }

    // Réponse
    const response = {
      configHash,
      criticalVars: Object.fromEntries(currentVarHashes.map((v) => [v.name, `sha256:${v.hash}`])),
      lastValidated: new Date().toISOString(),
      expectedHash,
      driftDetected: driftedVars.length > 0,
      criticalDrift,
      driftedVars: driftedVars.map((v) => ({
        name: v.name,
        criticality: v.criticality,
      })),
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error('Error in /api/health/config:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/health/config - Reset expected hash
 *
 * Utilisé après déploiement pour marquer nouvelle config comme référence
 */
export async function POST() {
  try {
    // Récupérer variables CRITICAL
    const criticalVars = getCriticalVariables()

    // Générer hashes actuels
    const currentVarHashes: CriticalVarHash[] = criticalVars.map((v) => ({
      name: v.name,
      hash: hashValue(process.env[v.name]),
      criticality: v.criticality,
    }))

    // Hash global
    const configHash = generateConfigHash(currentVarHashes)
    const varHashMap = Object.fromEntries(currentVarHashes.map((v) => [v.name, v.hash]))

    // Stocker comme nouveau hash attendu
    await redis.set(
      EXPECTED_HASH_KEY,
      JSON.stringify({
        hash: configHash,
        varHashes: varHashMap,
        timestamp: new Date().toISOString(),
      }),
      { EX: 30 * 24 * 60 * 60 } // 30 jours TTL
    )

    return NextResponse.json({
      success: true,
      message: 'Expected config hash updated',
      newHash: configHash,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error updating expected hash:', error)

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
