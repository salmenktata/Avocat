import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <span className="text-8xl font-extrabold text-primary/20">404</span>
        </div>
        <h1 className="text-2xl font-bold mb-3 text-foreground">
          Page introuvable
        </h1>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          La page que vous recherchez n&apos;existe pas ou a été déplacée.
        </p>
        <Button asChild>
          <Link href="/">
            Retour à l&apos;accueil
          </Link>
        </Button>
      </div>
    </div>
  )
}
