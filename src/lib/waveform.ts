export type EnergyLevel = 'low' | 'mid' | 'high'

export type TrackPart = {
  cue: string
  label: string
  start: number
  end: number
  energy: number
}

export type Bar = { height: number; level: EnergyLevel }

export function energyLevel(energy: number): EnergyLevel {
  if (energy >= 0.9) return 'high'
  if (energy >= 0.5) return 'mid'
  return 'low'
}

// Deterministic noise so the waveforms look the same on every render.
function noise(i: number, offset: number) {
  return Math.abs(Math.sin(i * 12.9898 + offset) * 43758.5453) % 1
}

function clampHeight(height: number) {
  return Math.max(0.08, Math.min(1, height))
}

export function levelBars(count: number, energy: number, seed: number): { height: number; opacity: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const r = noise(i, seed)
    return { height: Math.max(0.15, energy * (0.45 + 0.55 * r)), opacity: 0.55 + 0.45 * r }
  })
}

export function partsWave(parts: Pick<TrackPart, 'start' | 'end' | 'energy'>[], count: number, seed = 3.1): Bar[] {
  return Array.from({ length: count }, (_, i) => {
    const x = i / count
    const part = parts.find((p) => x >= p.start && x < p.end) ?? parts[parts.length - 1]
    return {
      height: clampHeight(part.energy * (0.6 + 0.4 * noise(i, seed))),
      level: energyLevel(part.energy),
    }
  })
}
