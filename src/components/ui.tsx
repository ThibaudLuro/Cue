import type { ReactNode } from 'react'

export function Dot() {
  return <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" />
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-line-strong px-2 py-[3px] text-xs text-data tabular-nums">
      {children}
    </span>
  )
}

export function MoodChip({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-accent/12 px-2.5 py-[3px] text-xs text-data">
      <Dot />
      {children}
    </span>
  )
}

const logoSizes = {
  md: { box: 'size-7 rounded-lg', bar: 'w-[3px] rounded-xs', heights: ['h-2', 'h-3.5', 'h-2.5'] },
  sm: { box: 'size-6 rounded-[7px]', bar: 'w-0.5 rounded-[1px]', heights: ['h-[7px]', 'h-3', 'h-[9px]'] },
}

export function Logo({ size = 'md' }: { size?: keyof typeof logoSizes }) {
  const { box, bar, heights } = logoSizes[size]
  return (
    <span aria-hidden="true" className={`flex items-center justify-center gap-0.5 bg-accent ${box}`}>
      {heights.map((height) => (
        <span key={height} className={`bg-canvas ${bar} ${height}`} />
      ))}
    </span>
  )
}
