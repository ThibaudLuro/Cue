import type { ReactNode } from 'react'

// Small uppercase label above a block of the tool.
export function Overline({ id, className = '', children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <p id={id} className={`text-xs tracking-[0.06em] text-subtle uppercase ${className}`}>
      {children}
    </p>
  )
}
