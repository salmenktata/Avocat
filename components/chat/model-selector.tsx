/**
 * Composant de sélection de mode LLM (Rapide vs Premium)
 *
 * Permet à l'utilisateur de basculer entre :
 * - Mode Rapide : Ollama Qwen3 8B (~15-20s, local gratuit)
 * - Mode Premium : Groq Llama 3.3 70B + cascade cloud (~1-5s, qualité maximale)
 */

'use client'

import { useState } from 'react'
import { Zap, Brain } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip'

export interface ModelSelectorProps {
  isPremium: boolean
  onToggle: (premium: boolean) => void
  disabled?: boolean
}

export function ModelSelector({
  isPremium,
  onToggle,
  disabled = false,
}: ModelSelectorProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isPremium ? 'default' : 'outline'}
            size="sm"
            onClick={() => onToggle(!isPremium)}
            disabled={disabled}
            className="gap-2"
          >
            {isPremium ? (
              <>
                <Brain className="h-4 w-4" />
                <span className="hidden sm:inline">Mode Premium</span>
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                <span className="hidden sm:inline">Mode Rapide</span>
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            {isPremium ? (
              <>
                <p className="font-semibold text-sm">
                  🧠 Mode Premium actif
                </p>
                <p className="text-xs text-muted-foreground">
                  Qualité maximale avec LLMs cloud (Groq → Gemini → DeepSeek → Ollama)
                </p>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-blue-500">ℹ️</span>
                  <span>~1-5s par réponse (Groq ultra-rapide)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Recommandé pour : analyses juridiques complexes, consultations
                  formelles, rédaction de documents
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-sm">
                  ⚡ Mode Rapide actif
                </p>
                <p className="text-xs text-muted-foreground">
                  Réponses rapides avec Qwen3 8B
                </p>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-green-500">✓</span>
                  <span>~15-20s par réponse</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Recommandé pour : questions simples, recherche rapide, chat
                  interactif
                </p>
              </>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
