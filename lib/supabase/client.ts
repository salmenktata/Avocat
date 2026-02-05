/**
 * Wrapper de compatibilité Supabase Client → NextAuth + API Routes
 *
 * DÉPRÉCIÉ : Ce fichier maintient la compatibilité avec le code legacy.
 * Pour nouveau code côté client, utiliser :
 * - useSession() de next-auth/react pour l'authentification
 * - fetch('/api/...') pour les requêtes à la base de données
 */

import { signIn, signOut, useSession } from 'next-auth/react'

/**
 * Crée un client compatible avec l'API Supabase
 * mais utilise NextAuth + API Routes en interne
 */
export const createClient = () => {
  return {
    // Auth methods
    auth: {
      async getUser() {
        const session = useSession()

        if (!session.data || !session.data.user) {
          return { data: { user: null }, error: null }
        }

        return {
          data: {
            user: {
              id: session.data.user.id,
              email: session.data.user.email,
              user_metadata: {
                name: session.data.user.name,
              },
            },
          },
          error: null,
        }
      },

      async getSession() {
        const session = useSession()

        if (!session.data) {
          return { data: { session: null }, error: null }
        }

        return {
          data: {
            session: {
              user: {
                id: session.data.user.id,
                email: session.data.user.email,
              },
            },
          },
          error: null,
        }
      },

      async signInWithPassword(credentials: { email: string; password: string }) {
        const result = await signIn('credentials', {
          ...credentials,
          redirect: false,
        })

        if (result?.error) {
          return {
            data: { user: null, session: null },
            error: { message: result.error },
          }
        }

        return {
          data: {
            user: { email: credentials.email },
            session: {},
          },
          error: null,
        }
      },

      async signOut() {
        await signOut({ redirect: false })
        return { error: null }
      },
    },

    // Database methods (via API routes)
    from(table: string) {
      return {
        async select(columns = '*') {
          try {
            const response = await fetch(`/api/${table}?select=${columns}`)

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`)
            }

            const data = await response.json()

            return {
              data: data.data || [],
              error: null,
              count: data.count || 0,
            }
          } catch (error: any) {
            return {
              data: null,
              error: { message: error.message },
              count: 0,
            }
          }
        },

        async insert(data: any) {
          try {
            const response = await fetch(`/api/${table}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            })

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`)
            }

            const result = await response.json()

            return {
              data: result.data,
              error: null,
            }
          } catch (error: any) {
            return {
              data: null,
              error: { message: error.message },
            }
          }
        },

        async update(data: any) {
          try {
            const response = await fetch(`/api/${table}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            })

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`)
            }

            const result = await response.json()

            return {
              data: result.data,
              error: null,
            }
          } catch (error: any) {
            return {
              data: null,
              error: { message: error.message },
            }
          }
        },

        async delete() {
          try {
            const response = await fetch(`/api/${table}`, {
              method: 'DELETE',
            })

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`)
            }

            const result = await response.json()

            return {
              data: result.data,
              error: null,
            }
          } catch (error: any) {
            return {
              data: null,
              error: { message: error.message },
            }
          }
        },

        // Chainable methods
        eq(column: string, value: any) {
          // TODO: Implémenter filtres chainables si nécessaire
          return this
        },

        single() {
          // TODO: Implémenter single() si nécessaire
          return this
        },
      }
    },

    // Storage methods (via API routes)
    storage: {
      from(bucket: string) {
        return {
          async upload(path: string, file: File) {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('path', path)

            try {
              const response = await fetch('/api/storage/upload', {
                method: 'POST',
                body: formData,
              })

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
              }

              const result = await response.json()

              return {
                data: result.data,
                error: null,
              }
            } catch (error: any) {
              return {
                data: null,
                error: { message: error.message },
              }
            }
          },

          async download(path: string) {
            try {
              const response = await fetch(`/api/storage/download?path=${encodeURIComponent(path)}`)

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
              }

              const blob = await response.blob()

              return {
                data: blob,
                error: null,
              }
            } catch (error: any) {
              return {
                data: null,
                error: { message: error.message },
              }
            }
          },

          async remove(paths: string[]) {
            try {
              const response = await fetch('/api/storage/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paths }),
              })

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
              }

              return {
                data: { message: 'Deleted' },
                error: null,
              }
            } catch (error: any) {
              return {
                data: null,
                error: { message: error.message },
              }
            }
          },
        }
      },
    },
  }
}

/**
 * Hook pour obtenir le client Supabase côté client
 * Note: Préférer useSession() de next-auth/react pour nouveau code
 */
export function useSupabaseClient() {
  return createClient()
}
