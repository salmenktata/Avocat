/**
 * Utilitaires de sécurité pour obfuscation des données sensibles dans les logs
 */

/**
 * Obfusquer une adresse email pour les logs
 * Exemple: "john.doe@example.com" → "jo***@ex***.com"
 */
export function obfuscateEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return '***'
  }

  const [localPart, domain] = email.split('@')
  const [domainName, tld] = domain.split('.')

  const obfuscatedLocal =
    localPart.length <= 2 ? '**' : localPart.substring(0, 2) + '***'
  const obfuscatedDomain =
    domainName.length <= 2 ? '**' : domainName.substring(0, 2) + '***'

  return `${obfuscatedLocal}@${obfuscatedDomain}.${tld}`
}

/**
 * Obfusquer un token/clé API pour les logs
 * Exemple: "sk_live_abc123xyz" → "sk_***xyz"
 */
export function obfuscateToken(token: string): string {
  if (!token || token.length < 8) {
    return '***'
  }

  const prefix = token.substring(0, 3)
  const suffix = token.substring(token.length - 3)

  return `${prefix}***${suffix}`
}

/**
 * Obfusquer un hash de mot de passe pour les logs
 * Exemple: "$2a$10$abc...xyz" → "$2a$10$abc...***"
 */
export function obfuscateHash(hash: string): string {
  if (!hash || hash.length < 15) {
    return '***'
  }

  return hash.substring(0, 12) + '***'
}

/**
 * Obfusquer un numéro de téléphone pour les logs
 * Exemple: "+33612345678" → "+336***5678"
 */
export function obfuscatePhone(phone: string): string {
  if (!phone || phone.length < 8) {
    return '***'
  }

  const prefix = phone.substring(0, 4)
  const suffix = phone.substring(phone.length - 4)

  return `${prefix}***${suffix}`
}
