/**
 * Wrapper de compatibilité Supabase → NextAuth + PostgreSQL
 *
 * Ce fichier fournit une API compatible avec l'ancien code Supabase
 * tout en utilisant NextAuth et PostgreSQL en arrière-plan.
 *
 * À MIGRER PROGRESSIVEMENT vers @/lib/db/postgres et @/lib/auth/session
 */

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { query } from '@/lib/db/postgres'

/**
 * Client Supabase émulé
 * Fournit les méthodes minimales pour compatibilité
 */
export async function createClient() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id

  return {
    auth: {
      getUser: async () => {
        if (!userId) {
          return { data: { user: null }, error: null }
        }

        try {
          const result = await query(
            'SELECT id, email, nom, prenom FROM users WHERE id = $1',
            [userId]
          )

          const user = result.rows[0]
          if (!user) {
            return { data: { user: null }, error: null }
          }

          return {
            data: {
              user: {
                id: user.id,
                email: user.email,
                user_metadata: {
                  nom: user.nom,
                  prenom: user.prenom,
                },
              },
            },
            error: null,
          }
        } catch (error: any) {
          console.error('Erreur getUser:', error)
          return { data: { user: null }, error }
        }
      },
    },

    from: (table: string) => ({
      select: (columns = '*') => {
        const queryBuilder = {
          _columns: columns,
          _table: table,
          _params: [] as any[],
          _filters: [] as string[],
          _orderBy: '' as string,
          _limit: '' as string,

          eq(column: string, value: any) {
            const paramIndex = this._params.length + 1
            this._params.push(value)
            this._filters.push(`${column} = $${paramIndex}`)
            return this
          },

          neq(column: string, value: any) {
            const paramIndex = this._params.length + 1
            this._params.push(value)
            this._filters.push(`${column} != $${paramIndex}`)
            return this
          },

          gt(column: string, value: any) {
            const paramIndex = this._params.length + 1
            this._params.push(value)
            this._filters.push(`${column} > $${paramIndex}`)
            return this
          },

          gte(column: string, value: any) {
            const paramIndex = this._params.length + 1
            this._params.push(value)
            this._filters.push(`${column} >= $${paramIndex}`)
            return this
          },

          lt(column: string, value: any) {
            const paramIndex = this._params.length + 1
            this._params.push(value)
            this._filters.push(`${column} < $${paramIndex}`)
            return this
          },

          lte(column: string, value: any) {
            const paramIndex = this._params.length + 1
            this._params.push(value)
            this._filters.push(`${column} <= $${paramIndex}`)
            return this
          },

          in(column: string, values: any[]) {
            if (values.length === 0) return this
            const placeholders = values.map((_, i) => `$${this._params.length + i + 1}`)
            this._params.push(...values)
            this._filters.push(`${column} IN (${placeholders.join(', ')})`)
            return this
          },

          is(column: string, value: null | boolean) {
            if (value === null) {
              this._filters.push(`${column} IS NULL`)
            } else {
              this._filters.push(`${column} IS ${value}`)
            }
            return this
          },

          order(column: string, options?: { ascending?: boolean }) {
            const direction = options?.ascending ? 'ASC' : 'DESC'
            this._orderBy = ` ORDER BY ${column} ${direction}`
            return this
          },

          limit(count: number) {
            this._limit = ` LIMIT ${count}`
            return this
          },

          single() {
            this._limit = ' LIMIT 1'
            return this._execute(true)
          },

          async _execute(single = false) {
            try {
              // Construire requête dans le bon ordre: SELECT FROM WHERE ORDER LIMIT
              let sql = `SELECT ${this._columns} FROM ${this._table}`

              // Ajouter filtre user_id si applicable
              const tablesWithUserId = ['clients', 'dossiers', 'documents', 'factures', 'echeances', 'actions', 'time_entries', 'templates', 'profiles']
              if (tablesWithUserId.includes(this._table) && userId) {
                const paramIndex = this._params.length + 1
                this._params.push(userId)
                this._filters.push(`user_id = $${paramIndex}`)
              }

              // WHERE
              if (this._filters.length > 0) {
                sql += ' WHERE ' + this._filters.join(' AND ')
              }

              // ORDER BY
              if (this._orderBy) {
                sql += this._orderBy
              }

              // LIMIT
              if (this._limit) {
                sql += this._limit
              }

              console.log('🔍 Query:', sql, 'Params:', this._params)

              const result = await query(sql, this._params)

              if (single) {
                return { data: result.rows[0] || null, error: null }
              }

              return { data: result.rows, error: null }
            } catch (error: any) {
              console.error('Erreur query:', error)
              return { data: null, error }
            }
          },

          then(resolve: any, reject: any) {
            return this._execute().then(resolve, reject)
          },
        }

        return queryBuilder
      },

      insert: (values: any) => ({
        select: () => ({
          single: async () => {
            try {
              // Ajouter user_id si applicable
              const tablesWithUserId = ['clients', 'dossiers', 'documents', 'factures', 'echeances', 'actions', 'time_entries', 'templates']
              if (tablesWithUserId.includes(table) && userId && !values.user_id) {
                values.user_id = userId
              }

              const columns = Object.keys(values)
              const placeholders = columns.map((_, i) => `$${i + 1}`)
              const queryText = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`
              const params = Object.values(values)

              console.log('➕ Insert:', queryText, 'Params:', params)

              const result = await query(queryText, params)
              return { data: result.rows[0], error: null }
            } catch (error: any) {
              console.error('Erreur insert:', error)
              return { data: null, error }
            }
          },
        }),
      }),

      update: (values: any) => ({
        eq(column: string, value: any) {
          return {
            async select() {
              try {
                const sets = Object.keys(values).map((key, i) => `${key} = $${i + 1}`)
                const params = [...Object.values(values), value]

                let queryText = `UPDATE ${table} SET ${sets.join(', ')} WHERE ${column} = $${params.length}`

                // Ajouter filtre user_id
                const tablesWithUserId = ['clients', 'dossiers', 'documents', 'factures', 'echeances', 'actions', 'time_entries', 'templates']
                if (tablesWithUserId.includes(table) && userId) {
                  params.push(userId)
                  queryText += ` AND user_id = $${params.length}`
                }

                queryText += ' RETURNING *'

                console.log('✏️  Update:', queryText, 'Params:', params)

                const result = await query(queryText, params)
                return { data: result.rows, error: null }
              } catch (error: any) {
                console.error('Erreur update:', error)
                return { data: null, error }
              }
            },
          }
        },
      }),

      delete: () => ({
        eq(column: string, value: any) {
          return {
            async select() {
              try {
                let queryText = `DELETE FROM ${table} WHERE ${column} = $1`
                const params = [value]

                // Ajouter filtre user_id
                const tablesWithUserId = ['clients', 'dossiers', 'documents', 'factures', 'echeances', 'actions', 'time_entries', 'templates']
                if (tablesWithUserId.includes(table) && userId) {
                  params.push(userId)
                  queryText += ` AND user_id = $${params.length}`
                }

                queryText += ' RETURNING *'

                console.log('🗑️  Delete:', queryText, 'Params:', params)

                const result = await query(queryText, params)
                return { data: result.rows, error: null }
              } catch (error: any) {
                console.error('Erreur delete:', error)
                return { data: null, error }
              }
            },
          }
        },
      }),
    }),

    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, file: File | Buffer) => {
          console.warn('⚠️  Storage.upload() non implémenté - Utiliser MinIO directement')
          return { data: null, error: new Error('Storage non implémenté') }
        },
        download: async (path: string) => {
          console.warn('⚠️  Storage.download() non implémenté - Utiliser MinIO directement')
          return { data: null, error: new Error('Storage non implémenté') }
        },
        remove: async (paths: string[]) => {
          console.warn('⚠️  Storage.remove() non implémenté - Utiliser MinIO directement')
          return { data: null, error: new Error('Storage non implémenté') }
        },
        getPublicUrl: (path: string) => {
          console.warn('⚠️  Storage.getPublicUrl() non implémenté - Utiliser MinIO directement')
          return { data: { publicUrl: '' } }
        },
      }),
    },
  }
}
