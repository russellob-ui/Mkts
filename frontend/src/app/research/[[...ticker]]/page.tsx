import { ResearchClient } from './ResearchClient'

export function generateStaticParams() {
  return [{ ticker: [] }]
}

export default function ResearchPage() {
  return <ResearchClient />
}
