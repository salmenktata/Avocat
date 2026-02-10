'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  LegalClassification,
  LegalContentCategory,
  LegalDomain,
  DocumentNature,
} from '@/lib/web-scraper/types'
import { LEGAL_DOMAIN_TRANSLATIONS, DOCUMENT_NATURE_TRANSLATIONS } from '@/lib/web-scraper/types'
import { LEGAL_CATEGORY_TRANSLATIONS, type LegalCategory } from '@/lib/categories/legal-categories'

interface ClassificationEditorProps {
  classification: LegalClassification
  onSave: (newClassification: {
    primaryCategory: LegalContentCategory
    subcategory?: string
    domain?: LegalDomain
    subdomain?: string
    documentNature?: DocumentNature
  }) => void
  onCancel: () => void
}

// Catégories depuis le système centralisé (toutes les 15)
const CATEGORIES = Object.keys(LEGAL_CATEGORY_TRANSLATIONS) as LegalCategory[]

// Domaines depuis le système centralisé
const DOMAINS = Object.keys(LEGAL_DOMAIN_TRANSLATIONS) as LegalDomain[]

// Natures de documents depuis le système centralisé
const DOCUMENT_NATURES = Object.keys(DOCUMENT_NATURE_TRANSLATIONS) as DocumentNature[]

/**
 * Label bilingue AR / FR pour l'affichage admin
 */
function bilingualLabel(ar: string, fr: string): string {
  return `${ar} — ${fr}`
}

export function ClassificationEditor({
  classification,
  onSave,
  onCancel,
}: ClassificationEditorProps) {
  const [category, setCategory] = useState<LegalContentCategory>(
    classification.primaryCategory
  )
  const [subcategory, setSubcategory] = useState(classification.subcategory || '')
  const [domain, setDomain] = useState<LegalDomain | ''>(
    classification.domain || ''
  )
  const [subdomain, setSubdomain] = useState(classification.subdomain || '')
  const [documentNature, setDocumentNature] = useState<DocumentNature | ''>(
    classification.documentNature || ''
  )

  const handleSave = () => {
    onSave({
      primaryCategory: category,
      subcategory: subcategory || undefined,
      domain: domain || undefined,
      subdomain: subdomain || undefined,
      documentNature: documentNature || undefined,
    })
  }

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier la classification</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Catégorie */}
          <div className="space-y-2">
            <Label htmlFor="category">Catégorie principale *</Label>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as LegalContentCategory)}
            >
              <SelectTrigger className="bg-slate-800 border-slate-600">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {bilingualLabel(LEGAL_CATEGORY_TRANSLATIONS[cat].ar, LEGAL_CATEGORY_TRANSLATIONS[cat].fr)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sous-catégorie */}
          <div className="space-y-2">
            <Label htmlFor="subcategory">Sous-catégorie</Label>
            <Input
              id="subcategory"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              className="bg-slate-800 border-slate-600"
              placeholder="Ex: contrats commerciaux"
            />
          </div>

          {/* Domaine */}
          <div className="space-y-2">
            <Label htmlFor="domain">Domaine juridique</Label>
            <Select
              value={domain}
              onValueChange={(value) => setDomain(value as LegalDomain | '')}
            >
              <SelectTrigger className="bg-slate-800 border-slate-600">
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">غير محدد — Non spécifié</SelectItem>
                {DOMAINS.map((dom) => (
                  <SelectItem key={dom} value={dom}>
                    {bilingualLabel(LEGAL_DOMAIN_TRANSLATIONS[dom].ar, LEGAL_DOMAIN_TRANSLATIONS[dom].fr)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sous-domaine */}
          <div className="space-y-2">
            <Label htmlFor="subdomain">Sous-domaine</Label>
            <Input
              id="subdomain"
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              className="bg-slate-800 border-slate-600"
              placeholder="Ex: divorce, succession..."
            />
          </div>

          {/* Nature du document */}
          <div className="space-y-2">
            <Label htmlFor="nature">Nature du document</Label>
            <Select
              value={documentNature}
              onValueChange={(value) => setDocumentNature(value as DocumentNature | '')}
            >
              <SelectTrigger className="bg-slate-800 border-slate-600">
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">غير محدد — Non spécifié</SelectItem>
                {DOCUMENT_NATURES.map((nature) => (
                  <SelectItem key={nature} value={nature}>
                    {bilingualLabel(DOCUMENT_NATURE_TRANSLATIONS[nature].ar, DOCUMENT_NATURE_TRANSLATIONS[nature].fr)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
            Sauvegarder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
