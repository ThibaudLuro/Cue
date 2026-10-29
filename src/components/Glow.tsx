import { tint } from '../lib/tint'

type GlowProps = {
  token: string
  strength: number
  // Size and position of the halo.
  className: string
}

export function Glow({ token, strength, className }: GlowProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute rounded-full ${className}`}
      style={{ background: `radial-gradient(circle, ${tint(token, strength)} 0%, transparent 65%)` }}
    />
  )
}
