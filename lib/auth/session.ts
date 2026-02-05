/**
 * Système d'authentification robuste avec cookies HttpOnly
 *
 * Utilise jose pour JWT et cookies HttpOnly pour la sécurité maximale.
 * Les tokens ne sont jamais accessibles côté client (protection XSS).
 */

import { SignJWT, jwtVerify, JWTPayload } from 'jose'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { query } from '@/lib/db/postgres'
import { compare } from 'bcryptjs'

// =============================================================================
// CONFIGURATION
// =============================================================================

const SECRET_KEY = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'fallback-secret-change-in-production'
)

const COOKIE_NAME = 'auth_session'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}
const SESSION_DURATION = 30 * 24 * 60 * 60 // 30 jours en secondes

// =============================================================================
// TYPES
// =============================================================================

export interface SessionUser {
  id: string
  email: string
  name: string
  role?: string
}

export interface Session {
  user: SessionUser
  expires: string
}

interface TokenPayload extends JWTPayload {
  user: SessionUser
}

// =============================================================================
// FONCTIONS JWT
// =============================================================================

/**
 * Crée un token JWT signé
 */
async function createToken(user: SessionUser): Promise<string> {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .setIssuedAt()
    .setSubject(user.id)
    .sign(SECRET_KEY)
}

/**
 * Vérifie et décode un token JWT
 */
async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY)
    return (payload as TokenPayload).user
  } catch (error) {
    // Token expiré ou invalide
    return null
  }
}

// =============================================================================
// GESTION COOKIES
// =============================================================================

/**
 * Définit le cookie de session HttpOnly
 */
export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = await createToken(user)
  const cookieStore = await cookies()

  cookieStore.set(COOKIE_NAME, token, {
    ...COOKIE_OPTIONS,
    maxAge: SESSION_DURATION,
  })
}

/**
 * Supprime le cookie de session
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

// =============================================================================
// API PUBLIQUE - SESSION
// =============================================================================

/**
 * Récupère la session utilisateur depuis le cookie HttpOnly
 * Compatible avec l'ancienne API NextAuth
 */
export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value

    if (!token) return null

    const user = await verifyToken(token)
    if (!user) return null

    return {
      user,
      expires: new Date(Date.now() + SESSION_DURATION * 1000).toISOString(),
    }
  } catch (error) {
    console.error('[Session] Erreur lecture session:', error)
    return null
  }
}

/**
 * Récupère l'utilisateur connecté ou redirige vers /login
 */
export async function requireAuth(): Promise<Session> {
  const session = await getSession()

  if (!session?.user) {
    redirect('/login')
  }

  return session
}

/**
 * Récupère l'ID de l'utilisateur connecté
 */
export async function getUserId(): Promise<string | null> {
  const session = await getSession()
  return session?.user?.id || null
}

/**
 * Vérifie si l'utilisateur est connecté
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession()
  return session !== null
}

/**
 * Récupère l'utilisateur actuel
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession()
  return session?.user || null
}

// =============================================================================
// AUTHENTIFICATION
// =============================================================================

/**
 * Authentifie un utilisateur avec email/mot de passe
 * Retourne l'utilisateur si les credentials sont valides, null sinon
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<SessionUser | null> {
  try {
    const result = await query(
      'SELECT id, email, password_hash, nom, prenom, role FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    )

    const user = result.rows[0]
    if (!user) {
      console.log('[Auth] Utilisateur non trouvé:', email)
      return null
    }

    const isValid = await compare(password, user.password_hash)
    if (!isValid) {
      console.log('[Auth] Mot de passe invalide pour:', email)
      return null
    }

    console.log('[Auth] Connexion réussie:', email)

    return {
      id: user.id,
      email: user.email,
      name: user.nom && user.prenom ? `${user.prenom} ${user.nom}` : user.email,
      role: user.role || 'user',
    }
  } catch (error) {
    console.error('[Auth] Erreur authentification:', error)
    return null
  }
}

/**
 * Connecte un utilisateur (authentifie + crée session)
 */
export async function loginUser(
  email: string,
  password: string
): Promise<{ success: boolean; user?: SessionUser; error?: string }> {
  const user = await authenticateUser(email, password)

  if (!user) {
    return { success: false, error: 'Email ou mot de passe incorrect' }
  }

  await setSessionCookie(user)
  return { success: true, user }
}

/**
 * Déconnecte l'utilisateur
 */
export async function logoutUser(): Promise<void> {
  await clearSessionCookie()
}
