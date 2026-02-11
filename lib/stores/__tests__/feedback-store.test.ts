/**
 * Tests unitaires pour feedback-store
 * Sprint 1 - Système Feedback
 */

import { renderHook, act } from '@testing-library/react'
import { useFeedbackStore } from '../feedback-store'

describe('feedback-store', () => {
  beforeEach(() => {
    // Reset store avant chaque test
    const { clearAllOperations, clearToasts, clearAllErrors } = useFeedbackStore.getState()
    clearAllOperations()
    clearToasts()
    clearAllErrors()
  })

  describe('Operations', () => {
    it('should start an operation', () => {
      const { result } = renderHook(() => useFeedbackStore())

      let operationId: string

      act(() => {
        operationId = result.current.startOperation('llm-chat', 'Generating response')
      })

      expect(operationId!).toBeDefined()
      expect(result.current.operations.size).toBe(1)
      expect(result.current.hasActiveOperations).toBe(true)

      const operation = result.current.getOperation(operationId!)
      expect(operation).toBeDefined()
      expect(operation?.type).toBe('llm-chat')
      expect(operation?.status).toBe('pending')
      expect(operation?.message).toBe('Generating response')
    })

    it('should update an operation', () => {
      const { result } = renderHook(() => useFeedbackStore())

      let operationId: string

      act(() => {
        operationId = result.current.startOperation('file-upload', 'Uploading file')
      })

      act(() => {
        result.current.updateOperation(operationId!, {
          progress: 50,
          message: 'Uploading file... 50%',
        })
      })

      const operation = result.current.getOperation(operationId!)
      expect(operation?.progress).toBe(50)
      expect(operation?.message).toBe('Uploading file... 50%')
    })

    it('should complete an operation successfully', () => {
      const { result } = renderHook(() => useFeedbackStore())

      let operationId: string

      act(() => {
        operationId = result.current.startOperation('api-fetch', 'Fetching data')
      })

      act(() => {
        result.current.completeOperation(operationId!, true, 'Data fetched')
      })

      const operation = result.current.getOperation(operationId!)
      expect(operation?.status).toBe('success')
      expect(operation?.message).toBe('Data fetched')
      expect(operation?.completedAt).toBeDefined()
    })

    it('should fail an operation', () => {
      const { result } = renderHook(() => useFeedbackStore())

      let operationId: string

      act(() => {
        operationId = result.current.startOperation('db-query', 'Querying database')
      })

      const error = new Error('Database connection failed')

      act(() => {
        result.current.failOperation(operationId!, error)
      })

      const operation = result.current.getOperation(operationId!)
      expect(operation?.status).toBe('error')
      expect(operation?.error).toBe(error)
      expect(operation?.message).toBe('Database connection failed')
    })

    it('should clear an operation', () => {
      const { result } = renderHook(() => useFeedbackStore())

      let operationId: string

      act(() => {
        operationId = result.current.startOperation('llm-embedding', 'Computing embeddings')
      })

      expect(result.current.operations.size).toBe(1)

      act(() => {
        result.current.clearOperation(operationId!)
      })

      expect(result.current.operations.size).toBe(0)
      expect(result.current.hasActiveOperations).toBe(false)
    })

    it('should get operations by type', () => {
      const { result } = renderHook(() => useFeedbackStore())

      act(() => {
        result.current.startOperation('llm-chat', 'Chat 1')
        result.current.startOperation('llm-embedding', 'Embedding 1')
        result.current.startOperation('llm-chat', 'Chat 2')
      })

      const chatOps = result.current.getOperationsByType('llm-chat')
      const embeddingOps = result.current.getOperationsByType('llm-embedding')

      expect(chatOps.length).toBe(2)
      expect(embeddingOps.length).toBe(1)
    })

    it('should get only active operations', () => {
      const { result } = renderHook(() => useFeedbackStore())

      let op1Id: string, op2Id: string, op3Id: string

      act(() => {
        op1Id = result.current.startOperation('api-fetch', 'Fetch 1')
        op2Id = result.current.startOperation('api-fetch', 'Fetch 2')
        op3Id = result.current.startOperation('api-fetch', 'Fetch 3')
      })

      act(() => {
        result.current.completeOperation(op1Id!, true)
        result.current.failOperation(op2Id!, new Error('Failed'))
      })

      const activeOps = result.current.getActiveOperations()

      expect(activeOps.length).toBe(1)
      expect(activeOps[0].id).toBe(op3Id!)
    })
  })

  describe('Toasts', () => {
    it('should show a success toast', () => {
      const { result } = renderHook(() => useFeedbackStore())

      let toastId: string

      act(() => {
        toastId = result.current.success('Success!', 'Operation completed', 5000)
      })

      expect(toastId!).toBeDefined()
      expect(result.current.toasts.length).toBe(1)

      const toast = result.current.toasts[0]
      expect(toast.variant).toBe('success')
      expect(toast.title).toBe('Success!')
      expect(toast.description).toBe('Operation completed')
      expect(toast.duration).toBe(5000)
      expect(toast.dismissible).toBe(true)
    })

    it('should show an error toast', () => {
      const { result } = renderHook(() => useFeedbackStore())

      let toastId: string

      act(() => {
        toastId = result.current.error('Error!', 'Something went wrong')
      })

      expect(toastId!).toBeDefined()
      expect(result.current.toasts.length).toBe(1)

      const toast = result.current.toasts[0]
      expect(toast.variant).toBe('error')
      expect(toast.title).toBe('Error!')
      expect(toast.description).toBe('Something went wrong')
      expect(toast.duration).toBeUndefined() // Errors persist by default
    })

    it('should show custom toast with action', () => {
      const { result } = renderHook(() => useFeedbackStore())

      const mockAction = jest.fn()

      let toastId: string

      act(() => {
        toastId = result.current.showToast({
          variant: 'warning',
          title: 'Warning',
          description: 'Are you sure?',
          action: {
            label: 'Confirm',
            onClick: mockAction,
          },
          duration: 7000,
        })
      })

      expect(result.current.toasts.length).toBe(1)

      const toast = result.current.toasts[0]
      expect(toast.action).toBeDefined()
      expect(toast.action?.label).toBe('Confirm')
    })

    it('should dismiss a toast', () => {
      const { result } = renderHook(() => useFeedbackStore())

      let toastId: string

      act(() => {
        toastId = result.current.info('Info', 'Some info')
      })

      expect(result.current.toasts.length).toBe(1)

      act(() => {
        result.current.dismissToast(toastId!)
      })

      expect(result.current.toasts.length).toBe(0)
    })

    it('should clear all toasts', () => {
      const { result } = renderHook(() => useFeedbackStore())

      act(() => {
        result.current.success('Success 1')
        result.current.info('Info 1')
        result.current.warning('Warning 1')
      })

      expect(result.current.toasts.length).toBe(3)

      act(() => {
        result.current.clearToasts()
      })

      expect(result.current.toasts.length).toBe(0)
    })
  })

  describe('Errors', () => {
    it('should add an error', () => {
      const { result } = renderHook(() => useFeedbackStore())

      const error = new Error('Test error')

      let errorId: string

      act(() => {
        errorId = result.current.addError(error, 'Test context', true)
      })

      expect(errorId!).toBeDefined()
      expect(result.current.errors.length).toBe(1)
      expect(result.current.hasErrors).toBe(true)

      const globalError = result.current.errors[0]
      expect(globalError.error).toBe(error)
      expect(globalError.context).toBe('Test context')
      expect(globalError.recoverable).toBe(true)
    })

    it('should clear an error', () => {
      const { result } = renderHook(() => useFeedbackStore())

      const error = new Error('Test error')

      let errorId: string

      act(() => {
        errorId = result.current.addError(error, 'Test context')
      })

      expect(result.current.errors.length).toBe(1)

      act(() => {
        result.current.clearError(errorId!)
      })

      expect(result.current.errors.length).toBe(0)
      expect(result.current.hasErrors).toBe(false)
    })

    it('should clear all errors', () => {
      const { result } = renderHook(() => useFeedbackStore())

      act(() => {
        result.current.addError(new Error('Error 1'), 'Context 1')
        result.current.addError(new Error('Error 2'), 'Context 2')
        result.current.addError(new Error('Error 3'), 'Context 3')
      })

      expect(result.current.errors.length).toBe(3)

      act(() => {
        result.current.clearAllErrors()
      })

      expect(result.current.errors.length).toBe(0)
      expect(result.current.hasErrors).toBe(false)
    })
  })

  describe('State flags', () => {
    it('should update hasActiveOperations correctly', () => {
      const { result } = renderHook(() => useFeedbackStore())

      expect(result.current.hasActiveOperations).toBe(false)

      let opId: string

      act(() => {
        opId = result.current.startOperation('llm-chat', 'Chatting')
      })

      expect(result.current.hasActiveOperations).toBe(true)

      act(() => {
        result.current.completeOperation(opId!, true)
      })

      expect(result.current.hasActiveOperations).toBe(false)
    })

    it('should update hasErrors correctly', () => {
      const { result } = renderHook(() => useFeedbackStore())

      expect(result.current.hasErrors).toBe(false)

      let errId: string

      act(() => {
        errId = result.current.addError(new Error('Test'), 'Context')
      })

      expect(result.current.hasErrors).toBe(true)

      act(() => {
        result.current.clearError(errId!)
      })

      expect(result.current.hasErrors).toBe(false)
    })
  })
})
