'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface BreadcrumbItem {
  label: string
  href: string
}

export default function Breadcrumbs() {
  const pathname = usePathname()

  // Générer les breadcrumbs à partir du pathname
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const paths = pathname.split('/').filter(Boolean)
    const breadcrumbs: BreadcrumbItem[] = [{ label: 'Accueil', href: '/dashboard' }]

    // Mapping des URLs vers des labels lisibles
    const labelMap: Record<string, string> = {
      dashboard: 'Tableau de bord',
      clients: 'Clients',
      dossiers: 'Dossiers',
      factures: 'Factures',
      echeances: 'Échéances',
      'time-tracking': 'Time Tracking',
      documents: 'Documents',
      templates: 'Templates',
      new: 'Nouveau',
      edit: 'Modifier',
    }

    let currentPath = ''
    paths.forEach((path, index) => {
      currentPath += `/${path}`

      // Skip les IDs (UUIDs)
      if (path.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        breadcrumbs.push({ label: 'Détails', href: currentPath })
      } else {
        const label = labelMap[path] || path.charAt(0).toUpperCase() + path.slice(1)
        breadcrumbs.push({ label, href: currentPath })
      }
    })

    return breadcrumbs
  }

  const breadcrumbs = generateBreadcrumbs()

  if (breadcrumbs.length <= 1) return null

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.href} className="flex items-center">
          {index > 0 && (
            <svg
              className="mx-2 h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
          {index === breadcrumbs.length - 1 ? (
            <span className="font-medium text-gray-900">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-blue-600 transition-colors">
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}
