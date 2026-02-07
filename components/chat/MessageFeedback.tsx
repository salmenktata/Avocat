'use client'

/**
 * Composant de feedback pour les messages chat
 *
 * Affiche des boutons thumbs up/down pour les messages assistant.
 * Visible uniquement pour les utilisateurs autorisés (super admin ou can_provide_feedback).
 */

import { useState, useEffect } from 'react'
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

// =============================================================================
// TYPES
// =============================================================================

interface MessageFeedbackProps {
  messageId: string
  canProvideFeedback: boolean
  className?: string
}

interface Feedback {
  id: string
  rating: 'positive' | 'negative'
  reasons: string[]
  comment: string | null
}

// Raisons de feedback négatif
const NEGATIVE_REASONS = [
  { id: 'incorrect', label: 'Réponse incorrecte', labelAr: 'إجابة خاطئة' },
  { id: 'incomplete', label: 'Réponse incomplète', labelAr: 'إجابة غير كاملة' },
  { id: 'irrelevant', label: 'Non pertinent', labelAr: 'غير ذي صلة' },
  { id: 'unclear', label: 'Pas clair', labelAr: 'غير واضح' },
  { id: 'outdated', label: 'Information obsolète', labelAr: 'معلومات قديمة' },
  { id: 'other', label: 'Autre', labelAr: 'أخرى' },
]

// =============================================================================
// COMPOSANT
// =============================================================================

export function MessageFeedback({
  messageId,
  canProvideFeedback,
  className,
}: MessageFeedbackProps) {
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showNegativeForm, setShowNegativeForm] = useState(false)
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [comment, setComment] = useState('')

  // Charger le feedback existant
  useEffect(() => {
    if (!canProvideFeedback) return

    const loadFeedback = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/chat/${messageId}/feedback`)
        if (response.ok) {
          const data = await response.json()
          setFeedback(data.feedback)
        }
      } catch (error) {
        console.error('Erreur chargement feedback:', error)
      } finally {
        setLoading(false)
      }
    }

    loadFeedback()
  }, [messageId, canProvideFeedback])

  // Ne rien afficher si l'utilisateur n'a pas la permission
  if (!canProvideFeedback) {
    return null
  }

  const submitFeedback = async (rating: 'positive' | 'negative', reasons: string[] = [], feedbackComment?: string) => {
    setSubmitting(true)
    try {
      const response = await fetch(`/api/chat/${messageId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          reasons,
          comment: feedbackComment,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setFeedback({
          id: data.feedbackId,
          rating,
          reasons,
          comment: feedbackComment || null,
        })
        setShowNegativeForm(false)
        setSelectedReasons([])
        setComment('')
      }
    } catch (error) {
      console.error('Erreur soumission feedback:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handlePositiveClick = () => {
    if (feedback?.rating === 'positive') {
      // Annuler le feedback
      deleteFeedback()
    } else {
      submitFeedback('positive')
    }
  }

  const handleNegativeClick = () => {
    if (feedback?.rating === 'negative') {
      deleteFeedback()
    } else {
      setShowNegativeForm(true)
    }
  }

  const deleteFeedback = async () => {
    try {
      await fetch(`/api/chat/${messageId}/feedback`, { method: 'DELETE' })
      setFeedback(null)
    } catch (error) {
      console.error('Erreur suppression feedback:', error)
    }
  }

  const toggleReason = (reasonId: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reasonId)
        ? prev.filter((r) => r !== reasonId)
        : [...prev, reasonId]
    )
  }

  const submitNegativeFeedback = () => {
    submitFeedback('negative', selectedReasons, comment)
  }

  if (loading) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {/* Bouton Thumbs Up */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handlePositiveClick}
        disabled={submitting}
        className={cn(
          'h-8 w-8 p-0',
          feedback?.rating === 'positive' && 'bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
        )}
        title="Réponse utile"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ThumbsUp
            className={cn(
              'h-4 w-4',
              feedback?.rating === 'positive' ? 'fill-current' : ''
            )}
          />
        )}
      </Button>

      {/* Bouton Thumbs Down avec Popover */}
      <Popover open={showNegativeForm} onOpenChange={setShowNegativeForm}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNegativeClick}
            disabled={submitting}
            className={cn(
              'h-8 w-8 p-0',
              feedback?.rating === 'negative' && 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
            )}
            title="Réponse à améliorer"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ThumbsDown
                className={cn(
                  'h-4 w-4',
                  feedback?.rating === 'negative' ? 'fill-current' : ''
                )}
              />
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <h4 className="font-medium text-sm">
              Pourquoi cette réponse n'est pas satisfaisante ?
            </h4>

            <div className="space-y-2">
              {NEGATIVE_REASONS.map((reason) => (
                <div key={reason.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={reason.id}
                    checked={selectedReasons.includes(reason.id)}
                    onCheckedChange={() => toggleReason(reason.id)}
                  />
                  <label
                    htmlFor={reason.id}
                    className="text-sm cursor-pointer"
                  >
                    {reason.label}
                  </label>
                </div>
              ))}
            </div>

            <Textarea
              placeholder="Commentaire optionnel..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              className="text-sm"
            />

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNegativeForm(false)}
              >
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={submitNegativeFeedback}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Envoyer
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default MessageFeedback
