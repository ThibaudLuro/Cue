import { energyLevel, partsWave, type EnergyLevel, type TrackPart } from '../lib/waveform'

export type Folder = {
  name: string
  depth: 0 | 1 | 2
  count?: number
  selected?: boolean
}

export const folders: Folder[] = [
  { name: 'SET_SAMEDI', depth: 0 },
  { name: '118–122 BPM', depth: 1, count: 14 },
  { name: '122–126 BPM', depth: 1, count: 23 },
  { name: 'Sombre', depth: 2, count: 9, selected: true },
  { name: 'Solaire', depth: 2, count: 8 },
  { name: 'Mélodique', depth: 2, count: 6 },
  { name: '126–130 BPM', depth: 1, count: 15 },
  { name: '130+ BPM', depth: 1, count: 8 },
]

export const trackParts: TrackPart[] = [
  { cue: 'A', label: 'Intro', start: 0, end: 0.12, energy: 0.35 },
  { cue: 'B', label: 'Montée', start: 0.12, end: 0.25, energy: 0.6 },
  { cue: 'C', label: 'Drop', start: 0.25, end: 0.45, energy: 1 },
  { cue: 'D', label: 'Break', start: 0.45, end: 0.58, energy: 0.35 },
  { cue: 'E', label: 'Drop 2', start: 0.58, end: 0.85, energy: 1 },
  { cue: 'F', label: 'Outro', start: 0.85, end: 1, energy: 0.4 },
]

export const trackBars = partsWave(trackParts, 150)

export const tracks = [
  { title: 'Kessler Unit — Concrete Bloom', bpm: 124, key: '9A', mood: 'Sombre', cues: 6 },
  { title: 'Ilan Morrow — Night Shift (Dub)', bpm: 124, key: '9B', mood: 'Sombre', cues: 5 },
  { title: 'Halden — Glass Floor', bpm: 125, key: '10A', mood: 'Sombre', cues: 7 },
]

export type CuePart = { cue: string; width: number; level: EnergyLevel }

function cueStrip(layout: [width: number, energy: number][]): CuePart[] {
  return layout.map(([width, energy], i) => ({
    cue: String.fromCharCode(65 + i),
    width,
    level: energyLevel(energy),
  }))
}

export const cueStrips = [
  {
    title: 'Concrete Bloom',
    meta: '124 · 9A',
    parts: cueStrip([[12, 0.3], [13, 0.6], [20, 1], [13, 0.3], [27, 1], [15, 0.3]]),
  },
  {
    title: 'Low Tide',
    meta: '122 · 8A',
    parts: cueStrip([[16, 0.3], [18, 0.6], [24, 1], [18, 0.3], [24, 0.4]]),
  },
  {
    title: 'Glass Floor',
    meta: '125 · 10A',
    parts: cueStrip([[10, 0.3], [10, 0.6], [22, 1], [10, 0.3], [10, 0.6], [26, 1], [12, 0.3]]),
  },
]

export const messyFiles = [
  'track_final_v2 (1).mp3',
  'Kessler Unit - Concrete Bloom (Original Mix).wav',
  'DL_20260412_093.mp3',
  'low tide MASTER.aiff',
  'Nouveau dossier (3)',
  'paloma_rhea_marin_edit.flac',
  'untitled 04.mp3',
  'mercury lys 126.mp3',
]

export const tidyFolders: { name: string; depth: 0 | 1 | 2; meta?: string }[] = [
  { name: 'CUE_USB', depth: 0 },
  { name: '118–121 BPM / Nocturne', depth: 1, meta: '4' },
  { name: '122–125 BPM / Sombre', depth: 1, meta: '9' },
  { name: 'Concrete Bloom', depth: 2, meta: 'A–F' },
  { name: 'Night Shift (Dub)', depth: 2, meta: 'A–E' },
  { name: '122–125 BPM / Solaire', depth: 1, meta: '8' },
  { name: '126–129 BPM / Hypnotique', depth: 1, meta: '5' },
  { name: '130+ BPM / Énergique', depth: 1, meta: '6' },
]
