// Translucent version of a theme color, for inline gradients: tint('--color-accent', 5).
export function tint(token: string, percent: number) {
  return `color-mix(in srgb, var(${token}) ${percent}%, transparent)`
}
