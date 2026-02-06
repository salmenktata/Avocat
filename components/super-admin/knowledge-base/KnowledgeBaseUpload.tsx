'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Icons } from '@/lib/icons'
import { useToast } from '@/lib/hooks/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { uploadKnowledgeDocumentAction } from '@/app/actions/knowledge-base'

export function KnowledgeBaseUpload() {
  const router = useRouter()
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    try {
      const formData = new FormData(e.currentTarget)

      if (file) {
        formData.set('file', file)
      }

      const result = await uploadKnowledgeDocumentAction(formData)

      if (result.error) {
        toast({
          title: 'Erreur',
          description: result.error,
          variant: 'destructive'
        })
      } else {
        toast({
          title: 'Document uploadé',
          description: `Le document "${result.document?.title}" a été ajouté.`
        })
        setIsOpen(false)
        setFile(null)
        router.refresh()
      }
    } catch {
      toast({
        title: 'Erreur',
        description: 'Une erreur est survenue',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-slate-800 border-slate-700">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-slate-700/50 transition rounded-t-lg">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Icons.upload className="h-5 w-5" />
                  Ajouter un document
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Cliquez pour ouvrir le formulaire d'upload
                </CardDescription>
              </div>
              <Icons.chevronDown className={`h-5 w-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Titre */}
                <div>
                  <Label className="text-slate-300">Titre *</Label>
                  <Input
                    name="title"
                    required
                    placeholder="Ex: Code Civil Tunisien"
                    className="mt-1 bg-slate-700 border-slate-600 text-white"
                  />
                </div>

                {/* Catégorie */}
                <div>
                  <Label className="text-slate-300">Catégorie *</Label>
                  <Select name="category" required defaultValue="autre">
                    <SelectTrigger className="mt-1 bg-slate-700 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      <SelectItem value="jurisprudence" className="text-white hover:bg-slate-700">Jurisprudence</SelectItem>
                      <SelectItem value="code" className="text-white hover:bg-slate-700">Code</SelectItem>
                      <SelectItem value="doctrine" className="text-white hover:bg-slate-700">Doctrine</SelectItem>
                      <SelectItem value="modele" className="text-white hover:bg-slate-700">Modèle</SelectItem>
                      <SelectItem value="autre" className="text-white hover:bg-slate-700">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Langue */}
                <div>
                  <Label className="text-slate-300">Langue *</Label>
                  <Select name="language" required defaultValue="ar">
                    <SelectTrigger className="mt-1 bg-slate-700 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      <SelectItem value="ar" className="text-white hover:bg-slate-700">Arabe</SelectItem>
                      <SelectItem value="fr" className="text-white hover:bg-slate-700">Français</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Auto-indexation */}
                <div>
                  <Label className="text-slate-300">Indexation automatique</Label>
                  <Select name="autoIndex" defaultValue="true">
                    <SelectTrigger className="mt-1 bg-slate-700 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-600">
                      <SelectItem value="true" className="text-white hover:bg-slate-700">Oui</SelectItem>
                      <SelectItem value="false" className="text-white hover:bg-slate-700">Non</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <div>
                <Label className="text-slate-300">Description</Label>
                <Textarea
                  name="description"
                  placeholder="Description du document..."
                  className="mt-1 bg-slate-700 border-slate-600 text-white"
                />
              </div>

              {/* Fichier ou texte */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-slate-300">Fichier (PDF, TXT, DOCX)</Label>
                  <Input
                    type="file"
                    accept=".pdf,.txt,.docx,.doc"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="mt-1 bg-slate-700 border-slate-600 text-white file:bg-slate-600 file:text-white file:border-0"
                  />
                  {file && (
                    <p className="text-xs text-slate-500 mt-1">{file.name}</p>
                  )}
                </div>

                <div>
                  <Label className="text-slate-300">Ou coller du texte</Label>
                  <Textarea
                    name="text"
                    placeholder="Collez le texte ici..."
                    className="mt-1 bg-slate-700 border-slate-600 text-white h-20"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? (
                    <>
                      <Icons.loader className="h-4 w-4 mr-2 animate-spin" />
                      Upload...
                    </>
                  ) : (
                    <>
                      <Icons.upload className="h-4 w-4 mr-2" />
                      Uploader
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
