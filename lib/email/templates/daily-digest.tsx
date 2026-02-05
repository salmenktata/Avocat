import React from 'react'

interface Echeance {
  id: string
  date: string
  type: string
  dossier_numero: string
  dossier_objet: string
  jours_restants: number
}

interface ActionUrgente {
  id: string
  titre: string
  priorite: string
  dossier_numero: string
  date_limite: string
}

interface Audience {
  id: string
  date: string
  heure: string
  tribunal: string
  dossier_numero: string
  dossier_objet: string
}

interface FactureImpayee {
  id: string
  numero: string
  client_nom: string
  montant_ttc: string
  date_echeance: string
  jours_retard: number
}

interface DailyDigestProps {
  avocatNom: string
  avocatPrenom?: string
  dateAujourdhui: string
  echeances: Echeance[]
  actionsUrgentes: ActionUrgente[]
  audiences: Audience[]
  facturesImpayees: FactureImpayee[]
  langue: 'fr' | 'ar'
  baseUrl: string
}

const translations = {
  fr: {
    title: 'Votre récapitulatif quotidien',
    greeting: 'Bonjour',
    intro: 'Voici votre récapitulatif des tâches et événements importants pour aujourd&apos;hui',
    echeances_title: 'Échéances à surveiller',
    echeances_empty: 'Aucune échéance dans les 15 prochains jours',
    actions_title: 'Actions urgentes',
    actions_empty: 'Aucune action urgente',
    audiences_title: 'Audiences de la semaine',
    audiences_empty: 'Aucune audience prévue cette semaine',
    factures_title: 'Factures impayées',
    factures_empty: 'Aucune facture impayée',
    voir_dossier: 'Voir le dossier',
    voir_facture: 'Voir la facture',
    jours_restants: 'jours restants',
    jours_retard: 'jours de retard',
    priorite: 'Priorité',
    footer: 'Vous recevez cet email car vous avez activé les notifications quotidiennes dans vos paramètres.',
    gerer_preferences: 'Gérer mes préférences',
    a: 'à',
  },
  ar: {
    title: 'ملخصك اليومي',
    greeting: 'مرحبا',
    intro: 'إليك ملخص المهام والأحداث المهمة لهذا اليوم',
    echeances_title: 'المواعيد النهائية المهمة',
    echeances_empty: 'لا توجد مواعيد نهائية في الـ 15 يومًا القادمة',
    actions_title: 'الإجراءات العاجلة',
    actions_empty: 'لا توجد إجراءات عاجلة',
    audiences_title: 'جلسات هذا الأسبوع',
    audiences_empty: 'لا توجد جلسات مقررة هذا الأسبوع',
    factures_title: 'الفواتير غير المدفوعة',
    factures_empty: 'لا توجد فواتير غير مدفوعة',
    voir_dossier: 'عرض الملف',
    voir_facture: 'عرض الفاتورة',
    jours_restants: 'يوم متبقي',
    jours_retard: 'يوم تأخير',
    priorite: 'الأولوية',
    footer: 'تتلقى هذا البريد الإلكتروني لأنك قمت بتفعيل الإشعارات اليومية في إعداداتك.',
    gerer_preferences: 'إدارة تفضيلاتي',
    a: 'في',
  },
}

const getUrgencyColor = (joursRestants: number) => {
  if (joursRestants <= 1) return '#dc2626' // Rouge (J-1)
  if (joursRestants <= 3) return '#f59e0b' // Orange (J-3)
  if (joursRestants <= 7) return '#eab308' // Jaune (J-7)
  return '#3b82f6' // Bleu (J-15)
}

const getUrgencyBadge = (joursRestants: number, langue: 'fr' | 'ar') => {
  if (joursRestants <= 1) return langue === 'fr' ? 'Urgent' : 'عاجل'
  if (joursRestants <= 3) return langue === 'fr' ? 'Important' : 'مهم'
  if (joursRestants <= 7) return langue === 'fr' ? 'À surveiller' : 'للمراقبة'
  return langue === 'fr' ? 'Info' : 'معلومة'
}

export const DailyDigestEmailTemplate: React.FC<DailyDigestProps> = ({
  avocatNom,
  avocatPrenom,
  dateAujourdhui,
  echeances,
  actionsUrgentes,
  audiences,
  facturesImpayees,
  langue = 'fr',
  baseUrl,
}) => {
  const t = translations[langue]
  const isRTL = langue === 'ar'
  const nomComplet = avocatPrenom ? `${avocatPrenom} ${avocatNom}` : avocatNom

  return (
    <html dir={isRTL ? 'rtl' : 'ltr'}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily: isRTL
            ? 'Arial, Tahoma, sans-serif'
            : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backgroundColor: '#f3f4f6',
        }}
      >
        <table
          width="100%"
          cellPadding="0"
          cellSpacing="0"
          style={{
            backgroundColor: '#f3f4f6',
            padding: '20px 0',
          }}
        >
          <tr>
            <td align="center">
              <table
                width="600"
                cellPadding="0"
                cellSpacing="0"
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}
              >
                {/* En-tête */}
                <tr>
                  <td
                    style={{
                      background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                      padding: '40px 30px',
                      textAlign: isRTL ? 'right' : 'left',
                    }}
                  >
                    <h1
                      style={{
                        margin: '0 0 10px 0',
                        fontSize: '28px',
                        fontWeight: 'bold',
                        color: '#ffffff',
                      }}
                    >
                      {t.title}
                    </h1>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '16px',
                        color: '#dbeafe',
                      }}
                    >
                      {dateAujourdhui}
                    </p>
                  </td>
                </tr>

                {/* Salutation */}
                <tr>
                  <td style={{ padding: '30px 30px 20px 30px', textAlign: isRTL ? 'right' : 'left' }}>
                    <p
                      style={{
                        margin: '0 0 10px 0',
                        fontSize: '18px',
                        color: '#111827',
                        fontWeight: '600',
                      }}
                    >
                      {t.greeting} {nomComplet},
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '14px',
                        color: '#6b7280',
                        lineHeight: '1.6',
                      }}
                    >
                      {t.intro}
                    </p>
                  </td>
                </tr>

                {/* Section Échéances */}
                <tr>
                  <td style={{ padding: '0 30px 20px 30px' }}>
                    <h2
                      style={{
                        margin: '0 0 15px 0',
                        fontSize: '20px',
                        fontWeight: '600',
                        color: '#1f2937',
                        textAlign: isRTL ? 'right' : 'left',
                      }}
                    >
                      {t.echeances_title}
                    </h2>
                    {echeances.length === 0 ? (
                      <p
                        style={{
                          margin: 0,
                          fontSize: '14px',
                          color: '#6b7280',
                          textAlign: isRTL ? 'right' : 'left',
                        }}
                      >
                        {t.echeances_empty}
                      </p>
                    ) : (
                      <table width="100%" cellPadding="0" cellSpacing="0">
                        {echeances.map((echeance, index) => {
                          const urgencyColor = getUrgencyColor(echeance.jours_restants)
                          const urgencyBadge = getUrgencyBadge(echeance.jours_restants, langue)
                          return (
                            <tr key={echeance.id}>
                              <td
                                style={{
                                  padding: '15px',
                                  backgroundColor: index % 2 === 0 ? '#f9fafb' : '#ffffff',
                                  borderRadius: '6px',
                                }}
                              >
                                <table width="100%" cellPadding="0" cellSpacing="0">
                                  <tr>
                                    <td style={{ textAlign: isRTL ? 'right' : 'left' }}>
                                      <div
                                        style={{
                                          display: 'inline-block',
                                          padding: '4px 10px',
                                          backgroundColor: urgencyColor,
                                          color: '#ffffff',
                                          borderRadius: '4px',
                                          fontSize: '12px',
                                          fontWeight: '600',
                                          marginBottom: '8px',
                                        }}
                                      >
                                        {urgencyBadge} • {echeance.jours_restants} {t.jours_restants}
                                      </div>
                                      <p
                                        style={{
                                          margin: '0 0 5px 0',
                                          fontSize: '15px',
                                          fontWeight: '600',
                                          color: '#111827',
                                        }}
                                      >
                                        {echeance.type}
                                      </p>
                                      <p
                                        style={{
                                          margin: '0 0 5px 0',
                                          fontSize: '13px',
                                          color: '#6b7280',
                                        }}
                                      >
                                        {echeance.dossier_objet}
                                      </p>
                                      <p
                                        style={{
                                          margin: 0,
                                          fontSize: '12px',
                                          color: '#9ca3af',
                                        }}
                                      >
                                        {echeance.dossier_numero} • {echeance.date}
                                      </p>
                                    </td>
                                    <td style={{ textAlign: isRTL ? 'left' : 'right', verticalAlign: 'middle' }}>
                                      <a
                                        href={`${baseUrl}/dossiers/${echeance.id}`}
                                        style={{
                                          display: 'inline-block',
                                          padding: '8px 16px',
                                          backgroundColor: '#2563eb',
                                          color: '#ffffff',
                                          textDecoration: 'none',
                                          borderRadius: '6px',
                                          fontSize: '13px',
                                          fontWeight: '500',
                                        }}
                                      >
                                        {t.voir_dossier}
                                      </a>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          )
                        })}
                      </table>
                    )}
                  </td>
                </tr>

                {/* Section Actions Urgentes */}
                {actionsUrgentes.length > 0 && (
                  <tr>
                    <td style={{ padding: '0 30px 20px 30px' }}>
                      <h2
                        style={{
                          margin: '0 0 15px 0',
                          fontSize: '20px',
                          fontWeight: '600',
                          color: '#1f2937',
                          textAlign: isRTL ? 'right' : 'left',
                        }}
                      >
                        {t.actions_title}
                      </h2>
                      <table width="100%" cellPadding="0" cellSpacing="0">
                        {actionsUrgentes.map((action, index) => (
                          <tr key={action.id}>
                            <td
                              style={{
                                padding: '15px',
                                backgroundColor: index % 2 === 0 ? '#fef2f2' : '#ffffff',
                                borderRadius: '6px',
                                borderLeft: '4px solid #dc2626',
                              }}
                            >
                              <table width="100%" cellPadding="0" cellSpacing="0">
                                <tr>
                                  <td style={{ textAlign: isRTL ? 'right' : 'left' }}>
                                    <p
                                      style={{
                                        margin: '0 0 5px 0',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        color: '#111827',
                                      }}
                                    >
                                      {action.titre}
                                    </p>
                                    <p
                                      style={{
                                        margin: '0 0 5px 0',
                                        fontSize: '13px',
                                        color: '#dc2626',
                                      }}
                                    >
                                      {t.priorite}: {action.priorite}
                                    </p>
                                    <p
                                      style={{
                                        margin: 0,
                                        fontSize: '12px',
                                        color: '#9ca3af',
                                      }}
                                    >
                                      {action.dossier_numero} • {action.date_limite}
                                    </p>
                                  </td>
                                  <td style={{ textAlign: isRTL ? 'left' : 'right', verticalAlign: 'middle' }}>
                                    <a
                                      href={`${baseUrl}/dossiers/${action.id}`}
                                      style={{
                                        display: 'inline-block',
                                        padding: '8px 16px',
                                        backgroundColor: '#dc2626',
                                        color: '#ffffff',
                                        textDecoration: 'none',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        fontWeight: '500',
                                      }}
                                    >
                                      {t.voir_dossier}
                                    </a>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        ))}
                      </table>
                    </td>
                  </tr>
                )}

                {/* Section Audiences */}
                {audiences.length > 0 && (
                  <tr>
                    <td style={{ padding: '0 30px 20px 30px' }}>
                      <h2
                        style={{
                          margin: '0 0 15px 0',
                          fontSize: '20px',
                          fontWeight: '600',
                          color: '#1f2937',
                          textAlign: isRTL ? 'right' : 'left',
                        }}
                      >
                        {t.audiences_title}
                      </h2>
                      <table width="100%" cellPadding="0" cellSpacing="0">
                        {audiences.map((audience, index) => (
                          <tr key={audience.id}>
                            <td
                              style={{
                                padding: '15px',
                                backgroundColor: index % 2 === 0 ? '#eff6ff' : '#ffffff',
                                borderRadius: '6px',
                              }}
                            >
                              <table width="100%" cellPadding="0" cellSpacing="0">
                                <tr>
                                  <td style={{ textAlign: isRTL ? 'right' : 'left' }}>
                                    <p
                                      style={{
                                        margin: '0 0 5px 0',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        color: '#111827',
                                      }}
                                    >
                                      {audience.date} {t.a} {audience.heure}
                                    </p>
                                    <p
                                      style={{
                                        margin: '0 0 5px 0',
                                        fontSize: '13px',
                                        color: '#6b7280',
                                      }}
                                    >
                                      {audience.tribunal}
                                    </p>
                                    <p
                                      style={{
                                        margin: 0,
                                        fontSize: '12px',
                                        color: '#9ca3af',
                                      }}
                                    >
                                      {audience.dossier_numero} • {audience.dossier_objet}
                                    </p>
                                  </td>
                                  <td style={{ textAlign: isRTL ? 'left' : 'right', verticalAlign: 'middle' }}>
                                    <a
                                      href={`${baseUrl}/dossiers/${audience.id}`}
                                      style={{
                                        display: 'inline-block',
                                        padding: '8px 16px',
                                        backgroundColor: '#2563eb',
                                        color: '#ffffff',
                                        textDecoration: 'none',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        fontWeight: '500',
                                      }}
                                    >
                                      {t.voir_dossier}
                                    </a>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        ))}
                      </table>
                    </td>
                  </tr>
                )}

                {/* Section Factures Impayées */}
                {facturesImpayees.length > 0 && (
                  <tr>
                    <td style={{ padding: '0 30px 20px 30px' }}>
                      <h2
                        style={{
                          margin: '0 0 15px 0',
                          fontSize: '20px',
                          fontWeight: '600',
                          color: '#1f2937',
                          textAlign: isRTL ? 'right' : 'left',
                        }}
                      >
                        {t.factures_title}
                      </h2>
                      <table width="100%" cellPadding="0" cellSpacing="0">
                        {facturesImpayees.map((facture, index) => (
                          <tr key={facture.id}>
                            <td
                              style={{
                                padding: '15px',
                                backgroundColor: index % 2 === 0 ? '#fefce8' : '#ffffff',
                                borderRadius: '6px',
                              }}
                            >
                              <table width="100%" cellPadding="0" cellSpacing="0">
                                <tr>
                                  <td style={{ textAlign: isRTL ? 'right' : 'left' }}>
                                    <p
                                      style={{
                                        margin: '0 0 5px 0',
                                        fontSize: '15px',
                                        fontWeight: '600',
                                        color: '#111827',
                                      }}
                                    >
                                      {facture.numero}
                                    </p>
                                    <p
                                      style={{
                                        margin: '0 0 5px 0',
                                        fontSize: '13px',
                                        color: '#6b7280',
                                      }}
                                    >
                                      {facture.client_nom} • {facture.montant_ttc}
                                    </p>
                                    <p
                                      style={{
                                        margin: 0,
                                        fontSize: '12px',
                                        color: '#dc2626',
                                        fontWeight: '600',
                                      }}
                                    >
                                      {facture.jours_retard} {t.jours_retard}
                                    </p>
                                  </td>
                                  <td style={{ textAlign: isRTL ? 'left' : 'right', verticalAlign: 'middle' }}>
                                    <a
                                      href={`${baseUrl}/factures/${facture.id}`}
                                      style={{
                                        display: 'inline-block',
                                        padding: '8px 16px',
                                        backgroundColor: '#eab308',
                                        color: '#ffffff',
                                        textDecoration: 'none',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        fontWeight: '500',
                                      }}
                                    >
                                      {t.voir_facture}
                                    </a>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        ))}
                      </table>
                    </td>
                  </tr>
                )}

                {/* Footer */}
                <tr>
                  <td
                    style={{
                      padding: '30px',
                      backgroundColor: '#f9fafb',
                      borderTop: '1px solid #e5e7eb',
                      textAlign: 'center',
                    }}
                  >
                    <p
                      style={{
                        margin: '0 0 15px 0',
                        fontSize: '12px',
                        color: '#6b7280',
                        lineHeight: '1.6',
                      }}
                    >
                      {t.footer}
                    </p>
                    <a
                      href={`${baseUrl}/parametres/notifications`}
                      style={{
                        display: 'inline-block',
                        padding: '10px 20px',
                        backgroundColor: '#ffffff',
                        color: '#2563eb',
                        textDecoration: 'none',
                        borderRadius: '6px',
                        border: '1px solid #2563eb',
                        fontSize: '13px',
                        fontWeight: '500',
                      }}
                    >
                      {t.gerer_preferences}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  )
}

// Version texte pour clients email qui ne supportent pas HTML
export const DailyDigestEmailText = ({
  avocatNom,
  avocatPrenom,
  dateAujourdhui,
  echeances,
  actionsUrgentes,
  audiences,
  facturesImpayees,
  langue = 'fr',
  baseUrl,
}: DailyDigestProps): string => {
  const t = translations[langue]
  const nomComplet = avocatPrenom ? `${avocatPrenom} ${avocatNom}` : avocatNom

  let text = `${t.title}\n`
  text += `${dateAujourdhui}\n\n`
  text += `${t.greeting} ${nomComplet},\n\n`
  text += `${t.intro}\n\n`

  // Échéances
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
  text += `${t.echeances_title}\n`
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
  if (echeances.length === 0) {
    text += `${t.echeances_empty}\n\n`
  } else {
    echeances.forEach((echeance) => {
      const urgencyBadge = getUrgencyBadge(echeance.jours_restants, langue)
      text += `[${urgencyBadge}] ${echeance.type}\n`
      text += `  ${echeance.dossier_objet}\n`
      text += `  ${echeance.dossier_numero} • ${echeance.date}\n`
      text += `  ${echeance.jours_restants} ${t.jours_restants}\n`
      text += `  ${baseUrl}/dossiers/${echeance.id}\n\n`
    })
  }

  // Actions urgentes
  if (actionsUrgentes.length > 0) {
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    text += `${t.actions_title}\n`
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
    actionsUrgentes.forEach((action) => {
      text += `${action.titre}\n`
      text += `  ${t.priorite}: ${action.priorite}\n`
      text += `  ${action.dossier_numero} • ${action.date_limite}\n`
      text += `  ${baseUrl}/dossiers/${action.id}\n\n`
    })
  }

  // Audiences
  if (audiences.length > 0) {
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    text += `${t.audiences_title}\n`
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
    audiences.forEach((audience) => {
      text += `${audience.date} ${t.a} ${audience.heure}\n`
      text += `  ${audience.tribunal}\n`
      text += `  ${audience.dossier_numero} • ${audience.dossier_objet}\n`
      text += `  ${baseUrl}/dossiers/${audience.id}\n\n`
    })
  }

  // Factures impayées
  if (facturesImpayees.length > 0) {
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    text += `${t.factures_title}\n`
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
    facturesImpayees.forEach((facture) => {
      text += `${facture.numero}\n`
      text += `  ${facture.client_nom} • ${facture.montant_ttc}\n`
      text += `  ${facture.jours_retard} ${t.jours_retard}\n`
      text += `  ${baseUrl}/factures/${facture.id}\n\n`
    })
  }

  // Footer
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
  text += `${t.footer}\n\n`
  text += `${t.gerer_preferences}: ${baseUrl}/parametres/notifications\n`

  return text
}
