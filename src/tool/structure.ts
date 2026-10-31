// Cuts a track into its parts (intro, build-up, drop, break…) from its energy over time,
// lined up on the beat grid. Pure functions, cheap enough to run on every analysed track.
import { CURVE_RATE, type EnergyCurve } from './audio'

// start, end and cue go from 0 (start of the track) to 1 (end). cue is where the hot cue goes:
// the start of the part, except for the intro whose cue sits on the first downbeat.
export type Section = { label: string; start: number; end: number; energy: number; cue: number }

// A part lasts at least this many bars: shorter changes are fills, not sections.
const MIN_BARS = 8
const MAX_SECTIONS = 10
// Without a tempo, "bars" of 2 seconds still give sensible cuts.
const FALLBACK_BAR = 2

function mean(values: number[], from: number, to: number) {
  const start = Math.max(0, Math.floor(from))
  const end = Math.min(values.length, Math.ceil(to))
  let sum = 0
  for (let i = start; i < end; i++) sum += values[i]
  return end > start ? sum / (end - start) : 0
}

type Bar = { time: number; full: number; bass: number }

function barsFrom(curve: EnergyCurve, duration: number, origin: number, barLength: number): Bar[] {
  const bars: Bar[] = []
  // Start on the grid line at or just before 0.
  for (let time = origin - Math.ceil(origin / barLength) * barLength; time < duration; time += barLength) {
    const from = Math.max(0, time) * CURVE_RATE
    const to = (time + barLength) * CURVE_RATE
    bars.push({ time: Math.max(0, time), full: mean(curve.full, from, to), bass: mean(curve.bass, from, to) })
  }
  return bars
}

// How much the music changes at each bar: before/after contrast over 4 bars, bass first
// (the kick coming in or out is what DJs cue on).
function novelty(bars: Bar[]) {
  const full = bars.map((bar) => bar.full)
  const bass = bars.map((bar) => bar.bass)
  return bars.map((_, b) => {
    if (b === 0) return 0
    const window = Math.min(4, b, bars.length - b)
    if (window === 0) return 0
    return (
      Math.abs(mean(bass, b, b + window) - mean(bass, b - window, b)) +
      0.5 * Math.abs(mean(full, b, b + window) - mean(full, b - window, b))
    )
  })
}

function topSum(values: number[], count: number) {
  return [...values].sort((a, b) => b - a).slice(0, count).reduce((a, b) => a + b, 0)
}

export function detectSections(
  curve: EnergyCurve,
  duration: number,
  bpm: number | null,
  beat: number | null,
): Section[] {
  if (!duration || curve.full.length === 0) return []
  const barLength = bpm ? 240 / bpm : FALLBACK_BAR

  // Which beat of four is the downbeat: the one on which the music changes the sharpest.
  let bars: Bar[] = []
  let changes: number[] = []
  let bestScore = -Infinity
  for (let r = 0; r < (bpm && beat !== null ? 4 : 1); r++) {
    const origin = bpm && beat !== null ? beat + (r * 60) / bpm : 0
    const candidate = barsFrom(curve, duration, origin, barLength)
    const candidateChanges = novelty(candidate)
    const score = topSum(candidateChanges, 6)
    if (score > bestScore) {
      bestScore = score
      bars = candidate
      changes = candidateChanges
    }
  }
  if (bars.length < MIN_BARS * 2) return [section('Intro', 0, duration, 1, firstDownbeat(bars), duration)]

  // Strongest changes first, keeping parts at least MIN_BARS long.
  const strongest = Math.max(...changes)
  const cuts: number[] = []
  for (const b of changes.map((_, i) => i).sort((a, c) => changes[c] - changes[a])) {
    if (cuts.length >= MAX_SECTIONS - 1) break
    // Too small to be a new part (in curve percent units, or next to the biggest change).
    if (changes[b] < 6 || changes[b] < strongest * 0.2) break
    if (b < MIN_BARS || bars.length - b < MIN_BARS) continue
    if (cuts.some((cut) => Math.abs(cut - b) < MIN_BARS)) continue
    cuts.push(b)
  }
  cuts.sort((a, b) => a - b)

  const fullOf = (from: number, to: number) => bars.slice(from, to).reduce((s, bar) => s + bar.full, 0) / (to - from)
  const part = (from: number, to: number) => {
    const half = from + Math.max(1, Math.floor((to - from) / 2))
    return {
      from,
      to,
      full: fullOf(from, to),
      bass: bars.slice(from, to).reduce((s, bar) => s + bar.bass, 0) / (to - from),
      rising: fullOf(half, to) > fullOf(from, half) * 1.15,
    }
  }
  type Part = ReturnType<typeof part>

  const edges = [0, ...cuts, bars.length]
  let parts = edges.slice(0, -1).map((from, i) => part(from, edges[i + 1]))

  const maxFull = Math.max(...parts.map((p) => p.full)) || 1
  const maxBass = Math.max(...parts.map((p) => p.bass)) || 1
  const isDrop = (p: Part) => p.full >= 0.85 * maxFull && p.bass >= 0.7 * maxBass
  const hasKick = (p: Part) => p.bass >= 0.45 * maxBass

  // A long stretch before a drop often ends in a build-up too gradual to show as a change:
  // when its last 8 bars climb, they become their own part.
  parts = parts.flatMap((p, i) => {
    const next = parts[i + 1]
    const split = p.to - MIN_BARS
    if (!next || !isDrop(next) || isDrop(p) || split - p.from < MIN_BARS * 2) return [p]
    return fullOf(split, p.to) > fullOf(split - MIN_BARS, split) * 1.15 ? [part(p.from, split), part(split, p.to)] : [p]
  })

  const labels = parts.map((p, i) => {
    const next = parts[i + 1]
    // No change at all (hypnotic loop): one part, cued at the start.
    if (parts.length === 1) return 'Intro'
    if (isDrop(p)) return 'Drop'
    if (i === 0) return 'Intro'
    if (i === parts.length - 1) return 'Outro'
    // A build-up is short; a long rise is still a break or a groove.
    if (next && isDrop(next) && p.rising && p.to - p.from <= MIN_BARS * 2) return 'Montée'
    if (!hasKick(p)) return 'Break'
    return next && isDrop(next) ? 'Montée' : 'Groove'
  })

  // Neighbours with the same role are one part; repeats get numbered: Drop, Drop 2…
  const merged: { label: string; from: number; to: number; full: number }[] = []
  parts.forEach((p, i) => {
    const last = merged[merged.length - 1]
    if (last && last.label === labels[i]) last.to = p.to
    else merged.push({ label: labels[i], from: p.from, to: p.to, full: p.full })
  })
  const seen: Record<string, number> = {}
  return merged.map((part, i) => {
    seen[part.label] = (seen[part.label] ?? 0) + 1
    const label = seen[part.label] > 1 ? `${part.label} ${seen[part.label]}` : part.label
    const start = i === 0 ? 0 : bars[part.from].time
    const end = part.to >= bars.length ? duration : bars[part.to].time
    const cue = i === 0 ? firstDownbeat(bars) : start
    return section(label, start, end, part.full / maxFull, cue, duration)
  })
}

// The first bar where the music has started (skips silence at the head of the file).
function firstDownbeat(bars: Bar[]) {
  return bars.find((bar) => bar.full > 5)?.time ?? 0
}

function section(label: string, start: number, end: number, energy: number, cue: number, duration: number): Section {
  return { label, start: start / duration, end: end / duration, energy, cue: cue / duration }
}
