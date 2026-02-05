/**
 * Index des services IA - RAG Platform
 *
 * Ce module exporte tous les services IA disponibles:
 * - Configuration et validation
 * - Génération d'embeddings (OpenAI)
 * - Extraction de texte (PDF/DOCX)
 * - Chunking de texte
 * - Chat RAG (Claude)
 * - Génération de documents
 * - Classification automatique
 * - Import jurisprudence
 * - Tracking d'utilisation
 */

// Configuration
export {
  aiConfig,
  validateAIConfig,
  isAIEnabled,
  isSemanticSearchEnabled,
  isChatEnabled,
  SYSTEM_PROMPTS,
  AI_COSTS,
  estimateCost,
} from './config'

// Embeddings (OpenAI)
export {
  generateEmbedding,
  generateEmbeddingsBatch,
  cosineSimilarity,
  formatEmbeddingForPostgres,
  parseEmbeddingFromPostgres,
  estimateTokenCount,
  isEmbeddingsServiceAvailable,
} from './embeddings-service'

// Extraction de texte
export {
  extractText,
  extractTextFromPDF,
  extractTextFromDocx,
  extractHtmlFromDocx,
  extractTextFromPlainText,
  isSupportedMimeType,
  getExtensionFromMimeType,
  type ParseResult,
  type SupportedMimeType,
} from './document-parser'

// Chunking
export {
  chunkText,
  chunkWithStructure,
  estimateChunkTokens,
  needsChunking,
  type Chunk,
  type ChunkMetadata,
  type ChunkingOptions,
} from './chunking-service'

// Chat RAG (Claude)
export {
  answerQuestion,
  createConversation,
  saveMessage,
  getUserConversations,
  deleteConversation,
  generateConversationTitle,
  type ChatSource,
  type ChatResponse,
  type ChatOptions,
} from './rag-chat-service'

// Génération de documents
export {
  generateFieldSuggestions,
  generateTextSuggestion,
  validateAndSuggestCorrections,
  type DocumentContext,
  type GenerationSuggestion,
  type DocumentSuggestions,
} from './document-generation-service'

// Classification automatique
export {
  classifyDocument,
  quickClassify,
  DOCUMENT_TYPE_LABELS,
  type DocumentClassification,
  type DocumentType,
  type ExtractedInfo,
  type SuggestedDossier,
} from './document-classifier'

// Import jurisprudence
export {
  importJurisprudence,
  importJurisprudenceBatch,
  extractJurisprudenceMetadata,
  getJurisprudenceStats,
  searchJurisprudence,
  type JurisprudenceMetadata,
  type ImportResult,
  type BatchImportResult,
  type JurisprudenceStats,
  type JurisprudenceSearchResult,
} from './jurisprudence-importer'

// Tracking d'utilisation
export {
  logUsage,
  logEmbeddingUsage,
  logChatUsage,
  logGenerationUsage,
  calculateCost,
  getUserMonthlyStats,
  getGlobalStats,
  checkBudgetLimit,
  type OperationType,
  type Provider,
  type UsageLog,
  type UsageStats,
} from './usage-tracker'
