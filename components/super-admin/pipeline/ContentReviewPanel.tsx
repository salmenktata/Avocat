'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icons } from '@/lib/icons'

interface ContentReviewPanelProps {
  document: {
    id: string
    title: string
    full_text: string | null
    language: string
    source_file: string | null
    metadata: Record<string, unknown>
  }
  onSave: (updates: { title?: string; full_text?: string; language?: string }) => Promise<void>
  isLoading: boolean
}

export function ContentReviewPanel({ document, onSave, isLoading }: ContentReviewPanelProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(document.title)
  const [fullText, setFullText] = useState(document.full_text || '')
  const [language, setLanguage] = useState(document.language)

  const wordCount = fullText.split(/\s+/).filter(Boolean).length
  const charCount = fullText.length

  const handleSave = async () => {
    const updates: Record<string, string> = {}
    if (title !== document.title) updates.title = title
    if (fullText !== (document.full_text || '')) updates.full_text = fullText
    if (language !== document.language) updates.language = language
    if (Object.keys(updates).length > 0) {
      await onSave(updates)
    }
    setIsEditing(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Contenu Extrait</h3>
        <div className="flex gap-2">
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Icons.edit className="h-4 w-4 mr-1" />
              Modifier
            </Button>
          ) : (
            <>
              <Button size="sm" onClick={handleSave} disabled={isLoading}>
                {isLoading ? <Icons.loader className="h-4 w-4 animate-spin mr-1" /> : <Icons.save className="h-4 w-4 mr-1" />}
                Enregistrer
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setTitle(document.title); setFullText(document.full_text || ''); setLanguage(document.language) }}>
                Annuler
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>{wordCount.toLocaleString()} mots</span>
        <span>{charCount.toLocaleString()} caractères</span>
        <span>Langue: {language}</span>
      </div>

      {/* Source URL */}
      {document.source_file && (
        <div className="text-sm">
          <span className="text-muted-foreground">Source: </span>
          <a href={document.source_file} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            {document.source_file}
            <Icons.externalLink className="h-3 w-3 inline ml-1" />
          </a>
        </div>
      )}

      {/* Title */}
      <div>
        <label className="text-sm font-medium">Titre</label>
        {isEditing ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        ) : (
          <p className="mt-1 text-sm">{document.title}</p>
        )}
      </div>

      {/* Language */}
      {isEditing && (
        <div>
          <label className="text-sm font-medium">Langue</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="mt-1 rounded-md border px-3 py-2 text-sm"
          >
            <option value="ar">Arabe</option>
            <option value="fr">Français</option>
          </select>
        </div>
      )}

      {/* Content */}
      <div>
        <label className="text-sm font-medium">Contenu</label>
        {isEditing ? (
          <textarea
            value={fullText}
            onChange={(e) => setFullText(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm font-mono"
            rows={20}
            dir={language === 'ar' ? 'rtl' : 'ltr'}
          />
        ) : (
          <div
            className="mt-1 max-h-[500px] overflow-y-auto rounded-md border p-4 text-sm whitespace-pre-wrap"
            dir={document.language === 'ar' ? 'rtl' : 'ltr'}
          >
            {document.full_text || <span className="text-muted-foreground italic">Aucun contenu</span>}
          </div>
        )}
      </div>
    </div>
  )
}
