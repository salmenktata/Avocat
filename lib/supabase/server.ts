/**
 * Wrapper de compatibilité Supabase → PostgreSQL + NextAuth
 *
 * DÉPRÉCIÉ : Ce fichier maintient la compatibilité avec le code legacy.
 * Pour nouveau code, utiliser directement :
 * - lib/db/postgres.ts pour requêtes base de données
 * - next-auth pour authentification (getServerSession)
 */

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { query, getClient, transaction } from '@/lib/db/postgres'

/**
 * Crée un client compatible avec l'API Supabase
 * mais utilise PostgreSQL + NextAuth en interne
 */
export const createClient = async () => {
  const session = await getServerSession(authOptions)

  return {
    // Auth methods
    auth: {
      async getUser() {
        if (!session || !session.user) {
          return { data: { user: null }, error: null }
        }

        return {
          data: {
            user: {
              id: session.user.id,
              email: session.user.email,
              user_metadata: {
                name: session.user.name,
              },
            },
          },
          error: null,
        }
      },

      async getSession() {
        if (!session) {
          return { data: { session: null }, error: null }
        }

        return {
          data: {
            session: {
              user: {
                id: session.user.id,
                email: session.user.email,
              },
            },
          },
          error: null,
        }
      },
    },

    // Database methods
    from(table: string) {
      return {
        async select(columns = '*') {
          try {
            const userId = session?.user?.id

            // Si pas de session, retourner vide
            if (!userId) {
              return { data: [], error: null, count: 0 }
            }

            const result = await query(
              `SELECT ${columns} FROM ${table} WHERE user_id = $1 AND deleted_at IS NULL`,
              [userId]
            )

            return {
              data: result.rows,
              error: null,
              count: result.rowCount || 0,
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
            const userId = session?.user?.id

            if (!userId) {
              throw new Error('Non authentifié')
            }

            // Ajouter user_id automatiquement
            const dataWithUser = { ...data, user_id: userId }

            const keys = Object.keys(dataWithUser)
            const values = Object.values(dataWithUser)
            const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')

            const result = await query(
              `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`,
              values
            )

            return {
              data: result.rows[0],
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
            const userId = session?.user?.id

            if (!userId) {
              throw new Error('Non authentifié')
            }

            const keys = Object.keys(data)
            const values = Object.values(data)
            const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ')

            const result = await query(
              `UPDATE ${table} SET ${setClause}, updated_at = NOW() WHERE user_id = $1 RETURNING *`,
              [userId, ...values]
            )

            return {
              data: result.rows,
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
            const userId = session?.user?.id

            if (!userId) {
              throw new Error('Non authentifié')
            }

            const result = await query(
              `UPDATE ${table} SET deleted_at = NOW() WHERE user_id = $1 RETURNING *`,
              [userId]
            )

            return {
              data: result.rows,
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

    // Storage methods (pour compatibilité, redirige vers MinIO)
    storage: {
      from(bucket: string) {
        return {
          async upload(path: string, file: File | Blob) {
            // TODO: Implémenter upload vers MinIO
            throw new Error('Storage.upload non implémenté - utiliser lib/storage/minio.ts')
          },

          async download(path: string) {
            // TODO: Implémenter download depuis MinIO
            throw new Error('Storage.download non implémenté - utiliser lib/storage/minio.ts')
          },

          async remove(paths: string[]) {
            // TODO: Implémenter remove depuis MinIO
            throw new Error('Storage.remove non implémenté - utiliser lib/storage/minio.ts')
          },
        }
      },
    },
  }
}

/**
 * Helper pour obtenir l'ID utilisateur courant
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  return session?.user?.id || null
}
