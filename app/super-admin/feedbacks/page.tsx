import { Metadata } from 'next'
import { FeedbacksClient } from './FeedbacksClient'

export const metadata: Metadata = {
  title: 'Feedbacks | Super Admin',
  description: 'Analyse des feedbacks utilisateurs sur les réponses RAG',
}

export const dynamic = 'force-dynamic'

export default function FeedbacksPage() {
  return <FeedbacksClient />
}
