'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Qadhya - Erreur</title>
        <style dangerouslySetInnerHTML={{ __html: `
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #0f172a;
            color: #f1f5f9;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem;
          }
          @media (prefers-color-scheme: light) {
            body { background: #ffffff; color: #1e293b; }
            .card { background: #f8fafc; border-color: #e2e8f0; }
            .message { color: #64748b; }
            .btn-secondary { background: #f1f5f9; color: #1e293b; }
            .btn-secondary:hover { background: #e2e8f0; }
          }
          .container { max-width: 540px; width: 100%; text-align: center; }
          .logo { font-size: 2rem; font-weight: 800; color: #3b82f6; letter-spacing: -0.02em; margin-bottom: 2.5rem; }
          .card { background: #1e293b; border: 1px solid #334155; border-radius: 1rem; padding: 2.5rem 2rem; animation: fadeInUp 0.6s ease-out; }
          .icon svg { width: 64px; height: 64px; color: #ef4444; margin-bottom: 1.5rem; }
          h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.75rem; }
          .message { font-size: 0.95rem; line-height: 1.7; color: #94a3b8; margin-bottom: 2rem; }
          .actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
          .btn { display: inline-flex; align-items: center; justify-content: center; padding: 0.625rem 1.5rem; border-radius: 0.5rem; font-size: 0.9rem; font-weight: 600; border: none; cursor: pointer; transition: all 0.2s; text-decoration: none; }
          .btn-primary { background: #3b82f6; color: white; }
          .btn-primary:hover { background: #2563eb; }
          .btn-secondary { background: #334155; color: #f1f5f9; }
          .btn-secondary:hover { background: #475569; }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          @media (max-width: 480px) { .card { padding: 2rem 1.25rem; } h1 { font-size: 1.25rem; } }
        `}} />
      </head>
      <body>
        <div className="container">
          <div className="logo">Qadhya</div>
          <div className="card">
            <div className="icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h1>Une erreur est survenue</h1>
            <p className="message">
              Nous sommes désolés, une erreur inattendue s&apos;est produite.
              Veuillez réessayer ou revenir à l&apos;accueil.
            </p>
            <div className="actions">
              <button className="btn btn-primary" onClick={() => reset()}>
                Réessayer
              </button>
              <a className="btn btn-secondary" href="/">
                Retour à l&apos;accueil
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
