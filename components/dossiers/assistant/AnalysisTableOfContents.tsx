'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { formatReadingTime } from '@/lib/utils/reading-time'

interface Section {
  id: string
  title: string
  readingTime?: number
  children?: Section[]
}

interface AnalysisTableOfContentsProps {
  sections: Section[]
  locale?: 'fr' | 'ar'
  className?: string
  onNavigate?: (sectionId: string) => void
}

const translations = {
  fr: {
    tableOfContents: 'Table des matières',
    totalReadingTime: 'Temps de lecture total',
    backToTop: 'Retour en haut',
  },
  ar: {
    tableOfContents: 'جدول المحتويات',
    totalReadingTime: 'إجمالي وقت القراءة',
    backToTop: 'العودة إلى الأعلى',
  },
}

// Flatten sections for scroll detection
function flattenSections(sections: Section[]): Section[] {
  const result: Section[] = []
  for (const section of sections) {
    result.push(section)
    if (section.children) {
      result.push(...section.children)
    }
  }
  return result
}

export function AnalysisTableOfContents({
  sections,
  locale = 'fr',
  className,
  onNavigate,
}: AnalysisTableOfContentsProps) {
  const t = translations[locale]
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [isSticky, setIsSticky] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const allSections = flattenSections(sections)

  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 200)

      for (const section of allSections) {
        const element = document.getElementById(section.id)
        if (element) {
          const rect = element.getBoundingClientRect()
          if (rect.top <= 100 && rect.bottom > 100) {
            setActiveSection(section.id)
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [allSections])

  const handleNavigate = useCallback(
    (sectionId: string) => {
      const element = document.getElementById(sectionId)
      if (element) {
        const yOffset = -80
        const y = element.getBoundingClientRect().top + window.scrollY + yOffset
        window.scrollTo({ top: y, behavior: 'smooth' })
        setActiveSection(sectionId)
        setMobileOpen(false)
        if (onNavigate) {
          onNavigate(sectionId)
        }
      }
    },
    [onNavigate]
  )

  const totalReadingTime = sections.reduce((acc, s) => acc + (s.readingTime || 0), 0)

  const tocContent = (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b">
        <Icons.list className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">{t.tableOfContents}</h3>
      </div>

      <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
        <Icons.clock className="h-3 w-3" />
        <span>
          {t.totalReadingTime}: {formatReadingTime(totalReadingTime, locale)}
        </span>
      </div>

      <nav className="space-y-0.5">
        {sections.map((section, index) => (
          <div key={section.id}>
            {/* Parent section */}
            <button
              onClick={() => handleNavigate(section.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm',
                'transition-colors hover:bg-muted',
                activeSection === section.id
                  ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary'
                  : 'text-muted-foreground'
              )}
            >
              <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs shrink-0">
                {index + 1}
              </span>
              <span className="flex-1 truncate">{section.title}</span>
              {section.readingTime && (
                <span className="text-[10px] opacity-70 shrink-0">
                  {formatReadingTime(section.readingTime, locale)}
                </span>
              )}
            </button>
            {/* Children */}
            {section.children && section.children.length > 0 && (
              <div className="ml-7 space-y-0.5">
                {section.children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => handleNavigate(child.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs',
                      'transition-colors hover:bg-muted',
                      activeSection === child.id
                        ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary'
                        : 'text-muted-foreground'
                    )}
                  >
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0" />
                    <span className="flex-1 truncate">{child.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="mt-4 pt-3 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <Icons.arrowUp className="h-3 w-3 mr-2" />
          {t.backToTop}
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop: sidebar sticky */}
      <div
        className={cn(
          'hidden lg:block',
          isSticky && 'sticky top-4',
          className
        )}
      >
        {tocContent}
      </div>

      {/* Mobile: floating button + Sheet */}
      <div className="lg:hidden fixed bottom-4 right-4 z-40">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button size="icon" className="rounded-full shadow-lg h-12 w-12">
              <Icons.list className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
            {tocContent}
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}

// Titres des sections
const sectionTitles: Record<string, { fr: string; ar: string }> = {
  qualification: { fr: 'Qualification Juridique', ar: 'التكييف القانوني' },
  syllogisme: { fr: 'Syllogisme Juridique', ar: 'القياس القانوني' },
  recevabilite: { fr: 'Recevabilité', ar: 'قبول الدعوى' },
  competence: { fr: 'Compétence', ar: 'الاختصاص' },
  strategie: { fr: 'Stratégie de Preuve', ar: 'استراتيجية الإثبات' },
  risques: { fr: 'Évaluation des Risques', ar: 'تقييم المخاطر' },
  recommandation: { fr: 'Recommandation', ar: 'التوصية' },
  references: { fr: 'Références', ar: 'المراجع' },
}

export function useAnalysisSections(
  analysisData: Record<string, unknown> | null,
  locale: 'fr' | 'ar' = 'fr'
): Section[] {
  if (!analysisData) return []

  const sectionIds = [
    'qualification',
    'syllogisme',
    'recevabilite',
    'competence',
    'strategie',
    'risques',
    'recommandation',
    'references',
  ]

  return sectionIds
    .filter((id) => analysisData[id])
    .map((id) => ({
      id,
      title: sectionTitles[id]?.[locale] || id,
      readingTime: estimateSectionReadingTime(analysisData[id]),
    }))
}

function estimateSectionReadingTime(content: unknown): number {
  if (!content) return 0

  let text = ''

  if (typeof content === 'string') {
    text = content
  } else if (typeof content === 'object') {
    text = JSON.stringify(content)
  }

  const wordCount = text.split(/\s+/).length
  return Math.ceil(wordCount / 200)
}
