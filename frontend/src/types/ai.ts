export interface Brief {
  label: string
  mode: 'concise' | 'detailed'
  bullets: string[]
  sections: Array<{ heading: string; content: string }> | null
  generatedAt: string | null
}
