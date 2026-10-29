import type { ReactNode } from 'react'

type SectionProps = {
  id?: string
  label?: string
  divider?: boolean
  // Reveal the direct children one after the other on scroll.
  revealGroup?: boolean
  // Classes for the inner 1200px container: vertical padding and layout.
  className: string
  children: ReactNode
}

// Sections are positioned so they paint above the hero glows.
export function Section({ id, label, divider = true, revealGroup, className, children }: SectionProps) {
  return (
    <section id={id} aria-label={label} className={divider ? 'relative border-t border-line' : 'relative'}>
      <div data-reveal-group={revealGroup} className={`mx-auto max-w-[1200px] px-6 ${className}`}>
        {children}
      </div>
    </section>
  )
}

export function SectionTitle({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <h2 className={`text-[clamp(32px,4vw,44px)] leading-[1.1] font-semibold tracking-[-0.03em] ${className}`}>
      {children}
    </h2>
  )
}

export function SectionHeader({ title, intro }: { title: ReactNode; intro: string }) {
  return (
    <div data-reveal className="mb-14 flex flex-wrap items-end justify-between gap-6">
      <SectionTitle className="max-w-[620px]">{title}</SectionTitle>
      <p className="max-w-[400px] text-muted">{intro}</p>
    </div>
  )
}
