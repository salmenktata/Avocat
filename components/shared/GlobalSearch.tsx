'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Users,
  Briefcase,
  Receipt,
  FileText,
  Search,
  Loader2,
  Sparkles,
  BookOpen,
} from 'lucide-react'

interface SearchResult {
  id: string
  type: 'client' | 'dossier' | 'facture' | 'document' | 'semantic' | 'jurisprudence'
  title: string
  subtitle?: string
  badge?: string
  url: string
  similarity?: number
}

interface SemanticSearchResult {
  documentId: string
  documentName: string
  dossierId: string | null
  dossierNumero: string | null
  contentChunk: string
  chunkIndex: number
  similarity: number
  metadata: Record<string, unknown>
}

export default function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [semanticEnabled, setSemanticEnabled] = useState(false)
  const [semanticAvailable, setSemanticAvailable] = useState(false)

  // Vérifier si la recherche sémantique est disponible
  useEffect(() => {
    checkSemanticAvailability()
  }, [])

  const checkSemanticAvailability = async () => {
    try {
      // Simple check - on vérifie si l'API répond
      const response = await fetch('/api/search/semantic?q=test', {
        method: 'HEAD',
      })
      // Si 503, c'est désactivé. Si 401 ou autre, c'est dispo mais non auth
      setSemanticAvailable(response.status !== 503)
    } catch {
      setSemanticAvailable(false)
    }
  }

  // Ouvrir avec Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Recherche avec debounce
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([])
      return
    }

    const timeoutId = setTimeout(() => {
      if (semanticEnabled && semanticAvailable) {
        performSemanticSearch(query)
      } else {
        performSearch(query)
      }
    }, 300) // Debounce 300ms

    return () => clearTimeout(timeoutId)
  }, [query, semanticEnabled, semanticAvailable])

  // Recherche classique (keywords)
  const performSearch = async (searchQuery: string) => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(searchQuery)}`
      )
      const data = await response.json()

      const searchResults: SearchResult[] = []

      // Clients
      if (data.results.clients) {
        data.results.clients.forEach((client: any) => {
          searchResults.push({
            id: client.id,
            type: 'client',
            title:
              client.type_client === 'PERSONNE_PHYSIQUE'
                ? `${client.nom} ${client.prenom || ''}`.trim()
                : client.nom,
            subtitle: client.cin ? `CIN: ${client.cin}` : client.telephone,
            badge: client.type_client,
            url: `/dashboard/clients/${client.id}`,
          })
        })
      }

      // Dossiers
      if (data.results.dossiers) {
        data.results.dossiers.forEach((dossier: any) => {
          searchResults.push({
            id: dossier.id,
            type: 'dossier',
            title: dossier.numero,
            subtitle:
              dossier.objet?.substring(0, 60) +
              (dossier.objet?.length > 60 ? '...' : ''),
            badge: dossier.statut,
            url: `/dashboard/dossiers/${dossier.id}`,
          })
        })
      }

      // Factures
      if (data.results.factures) {
        data.results.factures.forEach((facture: any) => {
          searchResults.push({
            id: facture.id,
            type: 'facture',
            title: facture.numero,
            subtitle: `${facture.montant_ttc} TND`,
            badge: facture.statut,
            url: `/dashboard/factures/${facture.id}`,
          })
        })
      }

      // Documents
      if (data.results.documents) {
        data.results.documents.forEach((document: any) => {
          searchResults.push({
            id: document.id,
            type: 'document',
            title: document.nom_fichier,
            subtitle: document.type_fichier,
            url: `/dashboard/documents/${document.id}`,
          })
        })
      }

      setResults(searchResults)
    } catch (error) {
      console.error('Erreur recherche:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  // Recherche sémantique (IA)
  const performSemanticSearch = async (searchQuery: string) => {
    setLoading(true)
    try {
      const response = await fetch('/api/search/semantic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          limit: 15,
          includeJurisprudence: true,
        }),
      })

      if (!response.ok) {
        // Fallback vers recherche classique
        performSearch(searchQuery)
        return
      }

      const data = await response.json()

      const searchResults: SearchResult[] = data.results.map(
        (result: SemanticSearchResult) => {
          const isJurisprudence =
            (result.metadata as any)?.sourceType === 'jurisprudence'

          return {
            id: result.documentId,
            type: isJurisprudence ? 'jurisprudence' : 'semantic',
            title: result.documentName,
            subtitle: truncateText(result.contentChunk, 100),
            badge: result.dossierNumero || (isJurisprudence ? 'Jurisprudence' : undefined),
            url: isJurisprudence
              ? '#' // Pour l'instant, pas de page détail jurisprudence
              : result.dossierId
                ? `/dashboard/dossiers/${result.dossierId}`
                : `/dashboard/documents`,
            similarity: result.similarity,
          }
        }
      )

      setResults(searchResults)
    } catch (error) {
      console.error('Erreur recherche sémantique:', error)
      // Fallback vers recherche classique
      performSearch(searchQuery)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (url: string) => {
    if (url === '#') return // Ignore jurisprudence sans page
    setOpen(false)
    setQuery('')
    setResults([])
    router.push(url)
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'client':
        return <Users className="h-4 w-4 text-blue-600" />
      case 'dossier':
        return <Briefcase className="h-4 w-4 text-green-600" />
      case 'facture':
        return <Receipt className="h-4 w-4 text-orange-600" />
      case 'document':
        return <FileText className="h-4 w-4 text-purple-600" />
      case 'semantic':
        return <Sparkles className="h-4 w-4 text-indigo-600" />
      case 'jurisprudence':
        return <BookOpen className="h-4 w-4 text-amber-600" />
      default:
        return <Search className="h-4 w-4" />
    }
  }

  const getBadgeVariant = (type: string, badge?: string) => {
    if (type === 'dossier') {
      if (badge === 'ACTIF') return 'default'
      if (badge === 'TERMINE') return 'secondary'
      if (badge === 'ARCHIVE') return 'outline'
    }
    if (type === 'facture') {
      if (badge === 'PAYEE') return 'default'
      if (badge === 'IMPAYEE') return 'destructive'
      if (badge === 'PARTIELLE') return 'secondary'
    }
    if (type === 'jurisprudence') {
      return 'outline'
    }
    return 'outline'
  }

  // Grouper résultats par type
  const groupedResults = results.reduce(
    (acc, result) => {
      if (!acc[result.type]) {
        acc[result.type] = []
      }
      acc[result.type].push(result)
      return acc
    },
    {} as Record<string, SearchResult[]>
  )

  const typeLabels: Record<string, string> = {
    client: 'Clients',
    dossier: 'Dossiers',
    facture: 'Factures',
    document: 'Documents',
    semantic: 'Documents (Recherche IA)',
    jurisprudence: 'Jurisprudence',
  }

  return (
    <>
      {/* Bouton déclencheur */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground border rounded-lg hover:bg-accent transition-colors"
      >
        <Search className="h-4 w-4" />
        <span>Rechercher...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Command Dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <CommandInput
            placeholder={
              semanticEnabled
                ? 'Posez une question ou décrivez ce que vous cherchez...'
                : 'Rechercher clients, dossiers, factures, documents...'
            }
            value={query}
            onValueChange={setQuery}
            className="border-0"
          />

          {/* Toggle Recherche Intelligente */}
          {semanticAvailable && (
            <div className="flex items-center gap-2 ml-2 shrink-0">
              <Switch
                id="semantic-search"
                checked={semanticEnabled}
                onCheckedChange={setSemanticEnabled}
                className="data-[state=checked]:bg-indigo-600"
              />
              <Label
                htmlFor="semantic-search"
                className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="h-3 w-3" />
                IA
              </Label>
            </div>
          )}
        </div>

        <CommandList>
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              {semanticEnabled && (
                <span className="ml-2 text-sm text-muted-foreground">
                  Recherche intelligente en cours...
                </span>
              )}
            </div>
          )}

          {!loading && query && results.length === 0 && (
            <CommandEmpty>
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Search className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Aucun résultat trouvé
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {semanticEnabled
                    ? 'Essayez de reformuler votre question'
                    : 'Essayez avec un autre terme de recherche'}
                </p>
              </div>
            </CommandEmpty>
          )}

          {!loading && results.length > 0 && (
            <>
              {Object.entries(groupedResults).map(([type, items], index) => (
                <div key={type}>
                  {index > 0 && <CommandSeparator />}
                  <CommandGroup heading={typeLabels[type] || type}>
                    {items.map((result) => (
                      <CommandItem
                        key={`${result.type}-${result.id}`}
                        value={`${result.type}-${result.id}`}
                        onSelect={() => handleSelect(result.url)}
                        className="flex items-center gap-3 py-3 cursor-pointer"
                      >
                        {getIcon(result.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {result.title}
                          </p>
                          {result.subtitle && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {result.subtitle}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {result.similarity !== undefined && (
                            <span className="text-[10px] text-muted-foreground">
                              {Math.round(result.similarity * 100)}%
                            </span>
                          )}
                          {result.badge && (
                            <Badge
                              variant={getBadgeVariant(result.type, result.badge)}
                              className="shrink-0"
                            >
                              {result.badge}
                            </Badge>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </div>
              ))}
            </>
          )}

          {!loading && !query && (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              {semanticEnabled ? (
                <>
                  <Sparkles className="h-12 w-12 text-indigo-500/50 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Recherche intelligente activée
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 max-w-xs">
                    Posez une question en langage naturel. Exemple: "dossiers de
                    divorce avec garde d'enfants" ou "factures impayées du mois
                    dernier"
                  </p>
                </>
              ) : (
                <>
                  <Search className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Recherche rapide
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Tapez pour rechercher dans les clients, dossiers, factures
                    et documents
                  </p>
                </>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Users className="h-3 w-3 text-blue-600" />
                  <span>Clients</span>
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-3 w-3 text-green-600" />
                  <span>Dossiers</span>
                </div>
                <div className="flex items-center gap-2">
                  <Receipt className="h-3 w-3 text-orange-600" />
                  <span>Factures</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-3 w-3 text-purple-600" />
                  <span>Documents</span>
                </div>
              </div>

              {semanticAvailable && !semanticEnabled && (
                <p className="mt-4 text-[10px] text-muted-foreground">
                  💡 Activez la recherche IA pour des résultats plus pertinents
                </p>
              )}
            </div>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}

// Utilitaire pour tronquer le texte
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength).trim() + '...'
}
