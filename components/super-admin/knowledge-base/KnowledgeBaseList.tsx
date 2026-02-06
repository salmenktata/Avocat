'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icons } from '@/lib/icons'
import { useToast } from '@/lib/hooks/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  indexKnowledgeDocumentAction,
  deleteKnowledgeDocumentAction
} from '@/app/actions/knowledge-base'

interface Document {
  id: string
  title: string
  description: string
  category: string
  language: string
  is_indexed: boolean
  chunk_count: number
  file_name: string
  file_type: string
  uploaded_by_email: string
  created_at: Date
}

interface KnowledgeBaseListProps {
  documents: Document[]
  currentPage: number
  totalPages: number
  category: string
  indexed: string
  search: string
}

export function KnowledgeBaseList({
  documents,
  currentPage,
  totalPages,
  category,
  indexed,
  search
}: KnowledgeBaseListProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const handleIndex = async (id: string) => {
    setLoading(id)
    try {
      const result = await indexKnowledgeDocumentAction(id)
      if (result.error) {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive'
        })
      } else {
        toast({
          title: 'Document indexé',
          description: `${result.chunksCreated} chunks créés`
        })
        router.refresh()
      }
    } catch {
      toast({
        title: 'Erreur',
        description: 'Erreur lors de l\'indexation',
        variant: 'destructive'
      })
    } finally {
      setLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return

    setLoading(deleteId)
    try {
      const result = await deleteKnowledgeDocumentAction(deleteId)
      if (result.error) {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive'
        })
      } else {
        toast({
          title: 'Document supprimé',
          description: 'Le document a été supprimé'
        })
        router.refresh()
      }
    } catch {
      toast({
        title: 'Erreur',
        description: 'Erreur lors de la suppression',
        variant: 'destructive'
      })
    } finally {
      setLoading(null)
      setDeleteId(null)
    }
  }

  const getCategoryBadge = (cat: string) => {
    const colors: Record<string, string> = {
      jurisprudence: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
      code: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
      doctrine: 'bg-green-500/20 text-green-500 border-green-500/30',
      modele: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
      autre: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
    return (
      <Badge className={colors[cat] || colors.autre}>
        {cat}
      </Badge>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Icons.bookOpen className="h-12 w-12 mx-auto mb-4" />
        <p>Aucun document trouvé</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-start gap-4 p-4 rounded-lg bg-slate-700/50 hover:bg-slate-700/70 transition"
          >
            <div className="h-10 w-10 rounded-lg bg-slate-600 flex items-center justify-center shrink-0">
              <Icons.fileText className="h-5 w-5 text-slate-300" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-white">{doc.title}</p>
                {getCategoryBadge(doc.category)}
                <Badge variant="outline" className="border-slate-600 text-slate-400">
                  {doc.language === 'ar' ? 'Arabe' : 'Français'}
                </Badge>
                {doc.is_indexed ? (
                  <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                    <Icons.checkCircle className="h-3 w-3 mr-1" />
                    Indexé ({doc.chunk_count} chunks)
                  </Badge>
                ) : (
                  <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
                    Non indexé
                  </Badge>
                )}
              </div>

              {doc.description && (
                <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                  {doc.description}
                </p>
              )}

              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                {doc.file_name && (
                  <span className="flex items-center gap-1">
                    <Icons.attachment className="h-3 w-3" />
                    {doc.file_name}
                  </span>
                )}
                <span>
                  Ajouté le {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                </span>
                {doc.uploaded_by_email && (
                  <span>par {doc.uploaded_by_email}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!doc.is_indexed && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleIndex(doc.id)}
                  disabled={loading === doc.id}
                  className="border-blue-500/30 text-blue-500 hover:bg-blue-500/10"
                >
                  {loading === doc.id ? (
                    <Icons.loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Icons.zap className="h-4 w-4 mr-1" />
                      Indexer
                    </>
                  )}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDeleteId(doc.id)}
                disabled={loading === doc.id}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Icons.delete className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Link
            href={`/super-admin/knowledge-base?category=${category}&indexed=${indexed}&search=${search}&page=${Math.max(1, currentPage - 1)}`}
          >
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              className="border-slate-600 text-slate-300"
            >
              <Icons.chevronLeft className="h-4 w-4" />
            </Button>
          </Link>

          <span className="text-sm text-slate-400">
            Page {currentPage} / {totalPages}
          </span>

          <Link
            href={`/super-admin/knowledge-base?category=${category}&indexed=${indexed}&search=${search}&page=${Math.min(totalPages, currentPage + 1)}`}
          >
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              className="border-slate-600 text-slate-300"
            >
              <Icons.chevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}

      {/* Dialog de confirmation suppression */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-slate-800 border-slate-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Cette action est irréversible. Le document et tous ses chunks seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-700 text-white border-slate-600 hover:bg-slate-600">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
