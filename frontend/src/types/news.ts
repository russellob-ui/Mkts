export interface NewsArticle {
  title: string
  description: string | null
  source: string | null
  publishedAt: string | null
  url: string | null
  sentimentScore: number | null
  entities: Array<{
    symbol: string | null
    name: string | null
    sentimentScore: number | null
  }>
}
