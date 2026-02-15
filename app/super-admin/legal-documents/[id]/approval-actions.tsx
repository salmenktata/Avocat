'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface ApprovalActionsProps {
  documentId: string
  isApproved: boolean
  consolidationStatus: string
  approvedAt: string | null
}

export function ApprovalActions({
  documentId,
  isApproved,
  consolidationStatus,
  approvedAt,
}: ApprovalActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const canApprove = consolidationStatus === 'complete' && !isApproved

  async function handleApprove() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/api/admin/legal-documents/${documentId}/approve`, {
        method: 'POST',
      })
      const data = await res.json()
      if (res.ok) {
        setResult({
          success: true,
          message: data.indexing?.success
            ? `Approuvé et indexé (${data.indexing.chunksCreated} chunks)`
            : 'Approuvé',
        })
        router.refresh()
      } else {
        setResult({ success: false, message: data.error || 'Erreur' })
      }
    } catch {
      setResult({ success: false, message: 'Erreur réseau' })
    } finally {
      setLoading(false)
    }
  }

  async function handleRevoke() {
    if (!confirm('Révoquer l\'approbation ? Le document ne sera plus visible publiquement.')) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/api/admin/legal-documents/${documentId}/approve`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ success: true, message: 'Approbation révoquée' })
        router.refresh()
      } else {
        setResult({ success: false, message: data.error || 'Erreur' })
      }
    } catch {
      setResult({ success: false, message: 'Erreur réseau' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className={`text-sm ${result.success ? 'text-green-400' : 'text-red-400'}`}>
          {result.message}
        </span>
      )}

      {isApproved ? (
        <>
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            Approuvé
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRevoke}
            disabled={loading}
            className="text-red-400 border-red-500/30 hover:bg-red-500/10"
          >
            {loading ? 'Révocation...' : 'Révoquer'}
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          onClick={handleApprove}
          disabled={loading || !canApprove}
          className="bg-green-600 hover:bg-green-700 text-white"
          title={!canApprove ? 'Le document doit être consolidé avant approbation' : ''}
        >
          {loading ? 'Approbation...' : 'Approuver pour publication'}
        </Button>
      )}
    </div>
  )
}
