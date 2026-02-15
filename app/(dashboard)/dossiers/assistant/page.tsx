import { redirect } from 'next/navigation'

export default async function DossierAssistantPage(
  props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }
) {
  const sp = await props.searchParams
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string') params.set(key, value)
  }
  const qs = params.toString()
  redirect(`/qadhya-ia/structure${qs ? `?${qs}` : ''}`)
}
