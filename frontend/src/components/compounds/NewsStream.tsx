'use client'
import type { NewsArticle } from '@/types/news'
import { timeAgo } from '@/lib/utils'
import { ExternalLink } from 'lucide-react'

interface NewsStreamProps {
  articles: NewsArticle[]
  isLoading?: boolean
  maxItems?: number
}

export function NewsStream({ articles, isLoading, maxItems = 10 }: NewsStreamProps) {
  if (isLoading) {
    return (
      <div className="divide-y divide-[var(--color-border-subtle)]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-3 py-3 space-y-1.5 animate-pulse">
            <div className="h-3.5 w-full bg-[var(--color-bg-elevated)] rounded" />
            <div className="h-3 w-3/4 bg-[var(--color-bg-elevated)] rounded" />
            <div className="h-2.5 w-24 bg-[var(--color-bg-elevated)] rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (articles.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-[12px] text-[var(--color-text-muted)]">
        No news available
      </div>
    )
  }

  return (
    <div className="divide-y divide-[var(--color-border-subtle)]">
      {articles.slice(0, maxItems).map((article, i) => (
        <a
          key={i}
          href={article.url ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="block px-3 py-2.5 hover:bg-[var(--color-bg-elevated)] transition-colors group"
        >
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-[var(--color-text-primary)] leading-snug line-clamp-2 group-hover:text-[var(--color-accent-bright)]">
                {article.title}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {article.source && (
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {article.source}
                  </span>
                )}
                {article.publishedAt && (
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {timeAgo(article.publishedAt)}
                  </span>
                )}
              </div>
            </div>
            <ExternalLink
              size={11}
              className="text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 mt-0.5 shrink-0"
            />
          </div>
        </a>
      ))}
    </div>
  )
}
