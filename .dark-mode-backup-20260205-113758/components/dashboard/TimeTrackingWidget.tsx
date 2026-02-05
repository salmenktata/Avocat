'use client'

interface TimeTrackingWidgetProps {
  timeEntries: any[]
}

export default function TimeTrackingWidget({ timeEntries }: TimeTrackingWidgetProps) {
  // Calculer le temps total ce mois-ci
  const maintenant = new Date()
  const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1)

  const entriesCeMois = timeEntries.filter((e) => {
    const dateEntree = new Date(e.date)
    return dateEntree >= debutMois
  })

  const tempsTotal = entriesCeMois.reduce((acc, e) => acc + (e.duree_minutes || 0), 0)
  const revenusTotal = entriesCeMois.reduce(
    (acc, e) => acc + parseFloat(e.montant_calcule || 0),
    0
  )

  const heuresTotal = Math.floor(tempsTotal / 60)
  const minutesTotal = tempsTotal % 60

  // Temps par semaine (4 dernières semaines)
  const semaines = Array.from({ length: 4 }, (_, i) => {
    const debut = new Date()
    debut.setDate(debut.getDate() - (i + 1) * 7)
    debut.setHours(0, 0, 0, 0)

    const fin = new Date()
    fin.setDate(fin.getDate() - i * 7)
    fin.setHours(23, 59, 59, 999)

    const entresSemaine = timeEntries.filter((e) => {
      const dateEntree = new Date(e.date)
      return dateEntree >= debut && dateEntree <= fin
    })

    const minutes = entresSemaine.reduce((acc, e) => acc + (e.duree_minutes || 0), 0)

    return {
      label: `S${i + 1}`,
      heures: Math.round(minutes / 60),
    }
  }).reverse()

  const maxHeures = Math.max(...semaines.map((s) => s.heures), 1)

  // Taux horaire moyen
  const tauxMoyen = tempsTotal > 0 ? (revenusTotal / (tempsTotal / 60)).toFixed(2) : '0.00'

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-card-foreground mb-4">⏱️ Time Tracking</h2>

      {/* Statistiques du mois */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-lg bg-blue-100 dark:bg-blue-900/20 p-4">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Temps ce mois</p>
          <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-400">
            {heuresTotal}
            <span className="text-lg">h</span>
            {minutesTotal > 0 && <span className="text-base">{minutesTotal}m</span>}
          </p>
        </div>

        <div className="rounded-lg bg-green-100 dark:bg-green-900/20 p-4">
          <p className="text-xs font-medium text-green-600 dark:text-green-400">Revenus générés</p>
          <p className="mt-1 text-xl font-bold text-green-700 dark:text-green-400">
            {revenusTotal.toFixed(2)} <span className="text-sm">TND</span>
          </p>
        </div>
      </div>

      {/* Taux horaire moyen */}
      <div className="mb-6 rounded-lg bg-purple-100 dark:bg-purple-900/20 p-4">
        <p className="text-xs font-medium text-purple-600 dark:text-purple-400">Taux horaire moyen</p>
        <p className="mt-1 text-2xl font-bold text-purple-700 dark:text-purple-400">
          {tauxMoyen} <span className="text-sm">TND/h</span>
        </p>
      </div>

      {/* Graphique 4 dernières semaines */}
      <div>
        <p className="text-sm font-medium text-foreground mb-3">Heures par semaine</p>
        <div className="flex items-end justify-between gap-2" style={{ height: '80px' }}>
          {semaines.map((semaine, i) => (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div className="w-full flex flex-col justify-end" style={{ height: '60px' }}>
                <div
                  className="w-full bg-blue-500 dark:bg-blue-600 rounded-t transition-all duration-300 hover:bg-blue-600 dark:hover:bg-blue-500"
                  style={{ height: `${(semaine.heures / maxHeures) * 100}%` }}
                  title={`${semaine.heures}h`}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{semaine.label}</p>
              <p className="text-xs font-medium text-foreground">{semaine.heures}h</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
