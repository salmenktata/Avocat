/**
 * Génère l'URL d'autorisation Google OAuth
 *
 * Prérequis: Variables d'environnement
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 * - GOOGLE_REDIRECT_URI (optionnel, défaut: http://localhost:3000/api/auth/google/callback)
 */
import { google } from 'googleapis'

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ ERREUR: Variables d\'environnement manquantes')
  console.error('   Requis: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET')
  process.exit(1)
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
)

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
  ],
  prompt: 'consent',
})

console.log('\n🔐 URL d\'autorisation Google Drive:\n')
console.log(authUrl)
console.log('\n')
