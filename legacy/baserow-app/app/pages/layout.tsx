/** Allow slow shell + block prefetch on Vercel (default 10s is often too tight). */
export const maxDuration = 60

export default function PagesLayout({ children }: { children: React.ReactNode }) {
  return children
}
