/**
 * Module de chiffrement pour les données sensibles
 * Utilise AES-256-GCM pour le chiffrement symétrique
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // Pour AES, l'IV doit être de 16 bytes
const AUTH_TAG_LENGTH = 16 // Tag d'authentification de 16 bytes
const SALT_LENGTH = 64 // Salt de 64 bytes pour dériver la clé

/**
 * Obtenir la clé de chiffrement depuis les variables d'environnement
 * IMPORTANT: ENCRYPTION_KEY doit être défini dans .env
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY

  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY non défini dans les variables d\'environnement. ' +
      'Générez-en un avec: openssl rand -hex 32'
    )
  }

  if (key.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY doit faire 64 caractères (32 bytes en hex). ' +
      'Générez-en un avec: openssl rand -hex 32'
    )
  }

  return key
}

/**
 * Chiffrer une chaîne de caractères
 *
 * @param plaintext - Texte en clair à chiffrer
 * @returns Texte chiffré au format: iv:authTag:encryptedData (hex)
 *
 * @example
 * const encrypted = await encrypt('mon_token_secret')
 * // Retourne: "abc123:def456:789xyz..."
 */
export async function encrypt(plaintext: string): Promise<string> {
  if (!plaintext) {
    throw new Error('Le texte à chiffrer ne peut pas être vide')
  }

  try {
    const encryptionKey = getEncryptionKey()
    const key = Buffer.from(encryptionKey, 'hex')

    // Générer un IV aléatoire pour chaque chiffrement
    const iv = crypto.randomBytes(IV_LENGTH)

    // Créer le cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    // Chiffrer les données
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    // Récupérer le tag d'authentification
    const authTag = cipher.getAuthTag()

    // Retourner: iv:authTag:encryptedData (tout en hex)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  } catch (error) {
    console.error('[Crypto] Erreur lors du chiffrement:', error)
    throw new Error('Erreur lors du chiffrement des données')
  }
}

/**
 * Déchiffrer une chaîne de caractères
 *
 * @param ciphertext - Texte chiffré au format: iv:authTag:encryptedData (hex)
 * @returns Texte en clair
 *
 * @example
 * const decrypted = await decrypt('abc123:def456:789xyz...')
 * // Retourne: "mon_token_secret"
 */
export async function decrypt(ciphertext: string): Promise<string> {
  if (!ciphertext) {
    throw new Error('Le texte chiffré ne peut pas être vide')
  }

  try {
    const encryptionKey = getEncryptionKey()
    const key = Buffer.from(encryptionKey, 'hex')

    // Séparer les composants: iv:authTag:encryptedData
    const parts = ciphertext.split(':')
    if (parts.length !== 3) {
      throw new Error('Format de données chiffrées invalide')
    }

    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]

    // Créer le decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    // Déchiffrer les données
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    console.error('[Crypto] Erreur lors du déchiffrement:', error)
    throw new Error('Erreur lors du déchiffrement des données')
  }
}

/**
 * Vérifier si ENCRYPTION_KEY est correctement configuré
 */
export function isEncryptionConfigured(): boolean {
  try {
    getEncryptionKey()
    return true
  } catch {
    return false
  }
}

/**
 * Générer une nouvelle clé de chiffrement
 * ATTENTION: À utiliser uniquement lors de la configuration initiale
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex')
}
