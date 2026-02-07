import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Cleanup après chaque test
afterEach(() => {
  cleanup()
})

// Mock de next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => '/',
}))

// Mock du SessionProvider custom
vi.mock('@/components/providers/SessionProvider', () => ({
  useSession: () => ({
    user: null,
    loading: false,
    refresh: vi.fn(),
  }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock de next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'fr',
}))

// Mock des variables d'environnement
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:7002'
process.env.NEXT_PUBLIC_APP_NAME = 'Qadhya'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.NEXTAUTH_URL = 'http://localhost:7002'
