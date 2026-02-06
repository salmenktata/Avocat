import { NextResponse } from 'next/server'

// Force dynamic rendering - pas de prérendu statique
export const dynamic = 'force-dynamic'


export async function POST() {
  // Cette route n'est plus nécessaire avec NextAuth.
  // La déconnexion est gérée par NextAuth via /api/auth/signout
  return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'))
}
