/**
 * Wrapper de compatibilité Supabase côté client
 *
 * Ce fichier fournit une API compatible avec l'ancien code Supabase client
 * tout en utilisant NextAuth côté client.
 *
 * À MIGRER PROGRESSIVEMENT vers next-auth/react
 */

export const createClient = () => {
  console.warn('⚠️  lib/supabase/client.ts est un wrapper de compatibilité. Migrer vers NextAuth.')

  return {
    auth: {
      getSession: async () => {
        console.warn('⚠️  Utiliser useSession() de next-auth/react à la place')
        return { data: { session: null }, error: null }
      },
      getUser: async () => {
        console.warn('⚠️  Utiliser useSession() de next-auth/react à la place')
        return { data: { user: null }, error: null }
      },
      signOut: async () => {
        console.warn('⚠️  Utiliser signOut() de next-auth/react à la place')
        return { error: null }
      },
    },

    from: () => {
      console.error('❌ Supabase client queries non supportées côté client. Utiliser Server Actions.')
      throw new Error('Utiliser Server Actions pour les requêtes base de données')
    },

    storage: {
      from: () => {
        console.error('❌ Supabase storage non supporté côté client. Utiliser Server Actions.')
        throw new Error('Utiliser Server Actions pour le stockage')
      },
    },
  }
}
