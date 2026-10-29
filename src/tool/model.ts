import { partsWave } from '../lib/waveform'

export const MOODS = ['Nocturne', 'Aérien', 'Mélodique', 'Solaire', 'Hypnotique', 'Sombre', 'Énergique'] as const
export type Mood = (typeof MOODS)[number]

export const BPM_RANGES = ['118–121 BPM', '122–125 BPM', '126–129 BPM', '130+ BPM'] as const

export type Grouping = 'bpm' | 'mood'

// A part of a track: its name, its share of the track in % and its energy (0–1).
type Part = [label: string, length: number, energy: number]

export type Track = {
  id: number
  title: string
  artist: string
  bpm: number
  key: string
  mood: Mood | null
  energy: number
  duration: number
  parts: Part[]
  confidence: string
}

// position goes from 0 (start of the track) to 1 (end).
export type Cue = { label: string; position: number }
export type CueSlots = (Cue | null)[]

export const PAD_COUNT = 8
export const KEY_NAME = 'CUE_USB'
export const UNSORTED = 'unsorted'

const LAYOUT_A: Part[] = [['Intro', 12, 0.3], ['Montée', 13, 0.6], ['Drop', 20, 1], ['Break', 13, 0.3], ['Drop 2', 27, 1], ['Outro', 15, 0.3]]
const LAYOUT_B: Part[] = [['Intro', 16, 0.3], ['Montée', 18, 0.6], ['Drop', 24, 1], ['Break', 18, 0.3], ['Outro', 24, 0.4]]
const LAYOUT_C: Part[] = [['Intro', 10, 0.3], ['Couplet', 10, 0.6], ['Drop', 22, 1], ['Break', 10, 0.3], ['Montée', 10, 0.6], ['Drop 2', 26, 1], ['Outro', 12, 0.3]]
const LAYOUT_D: Part[] = [['Intro', 14, 0.3], ['Groove', 30, 0.7], ['Break', 14, 0.3], ['Groove 2', 28, 0.7], ['Outro', 14, 0.3]]

// Mock content of the plugged-in key, as Cue would have analysed it.
export const KEY_TRACKS: Track[] = [
  { id: 1, title: 'Concrete Bloom', artist: 'Kessler Unit', bpm: 124, key: '9A', mood: 'Sombre', energy: 4, duration: 412, parts: LAYOUT_A, confidence: 'élevée' },
  { id: 2, title: 'Night Shift (Dub)', artist: 'Ilan Morrow', bpm: 124, key: '9B', mood: 'Sombre', energy: 3, duration: 455, parts: LAYOUT_D, confidence: 'élevée' },
  { id: 3, title: 'Glass Floor', artist: 'Halden', bpm: 125, key: '10A', mood: 'Sombre', energy: 4, duration: 398, parts: LAYOUT_C, confidence: 'moyenne' },
  { id: 4, title: 'Undertow', artist: 'Mira Okon', bpm: 123, key: '8A', mood: 'Hypnotique', energy: 3, duration: 441, parts: LAYOUT_D, confidence: 'élevée' },
  { id: 5, title: 'Relay', artist: 'Sato & Field', bpm: 125, key: '7A', mood: 'Hypnotique', energy: 3, duration: 377, parts: LAYOUT_B, confidence: 'moyenne' },
  { id: 6, title: 'Low Tide', artist: 'Nora Vale', bpm: 122, key: '8A', mood: 'Mélodique', energy: 3, duration: 389, parts: LAYOUT_B, confidence: 'élevée' },
  { id: 7, title: 'Copper Sun', artist: 'Ayo Lindqvist', bpm: 123, key: '4A', mood: 'Solaire', energy: 3, duration: 352, parts: LAYOUT_A, confidence: 'élevée' },
  { id: 8, title: 'Paloma', artist: 'Rhea Marin', bpm: 124, key: '11B', mood: 'Solaire', energy: 4, duration: 366, parts: LAYOUT_C, confidence: 'élevée' },
  { id: 9, title: 'Daybreak Motel', artist: 'The Quiet Arcade', bpm: 122, key: '6B', mood: 'Mélodique', energy: 2, duration: 403, parts: LAYOUT_B, confidence: 'moyenne' },
  { id: 10, title: 'Driftwood', artist: 'Elan Roche', bpm: 120, key: '5A', mood: 'Aérien', energy: 2, duration: 421, parts: LAYOUT_B, confidence: 'élevée' },
  { id: 11, title: 'Saltwater', artist: 'Juno Park', bpm: 119, key: '3A', mood: 'Nocturne', energy: 2, duration: 446, parts: LAYOUT_D, confidence: 'élevée' },
  { id: 12, title: 'Blue Hour', artist: 'Odile Nakamura', bpm: 121, key: '8A', mood: 'Nocturne', energy: 3, duration: 392, parts: LAYOUT_A, confidence: 'moyenne' },
  { id: 13, title: 'Pressure Line', artist: 'Vektor Haus', bpm: 127, key: '1A', mood: 'Énergique', energy: 5, duration: 344, parts: LAYOUT_C, confidence: 'élevée' },
  { id: 14, title: 'Acid Rain Club', artist: 'Teo Brandt', bpm: 128, key: '2A', mood: 'Énergique', energy: 5, duration: 361, parts: LAYOUT_A, confidence: 'élevée' },
  { id: 15, title: 'Signal Fire', artist: 'Marta Kell', bpm: 128, key: '12A', mood: 'Sombre', energy: 4, duration: 375, parts: LAYOUT_C, confidence: 'moyenne' },
  { id: 16, title: 'Mercury', artist: 'Lys', bpm: 126, key: '7A', mood: 'Hypnotique', energy: 4, duration: 418, parts: LAYOUT_D, confidence: 'élevée' },
  { id: 17, title: 'Overpass', artist: 'Duo Ferro', bpm: 132, key: '10B', mood: 'Énergique', energy: 5, duration: 333, parts: LAYOUT_A, confidence: 'élevée' },
  { id: 18, title: 'Untitled 04', artist: 'Artiste inconnu', bpm: 125, key: '—', mood: null, energy: 3, duration: 368, parts: LAYOUT_B, confidence: 'faible, à confirmer' },
]

function bpmRange(bpm: number) {
  if (bpm < 122) return BPM_RANGES[0]
  if (bpm < 126) return BPM_RANGES[1]
  if (bpm < 130) return BPM_RANGES[2]
  return BPM_RANGES[3]
}

// Folder ids are "primary|secondary", e.g. "122–125 BPM|Sombre" when sorting by BPM first.
export function folderOf(track: Pick<Track, 'bpm' | 'mood'>, grouping: Grouping) {
  if (!track.mood) return UNSORTED
  const range = bpmRange(track.bpm)
  return grouping === 'bpm' ? `${range}|${track.mood}` : `${track.mood}|${range}`
}

export function folderSegments(folder: string): [string, string] {
  if (folder === UNSORTED) return ['Non classés', 'Ambiance à confirmer']
  const [primary, secondary] = folder.split('|')
  return [primary, secondary]
}

export function folderPath(track: Pick<Track, 'bpm' | 'mood'>, grouping: Grouping) {
  const folder = folderOf(track, grouping)
  const segments = folder === UNSORTED ? ['Non classés'] : folderSegments(folder)
  return [KEY_NAME, ...segments].join(' / ') + ' /'
}

export type FolderGroup = { label: string; count: number; folders: { id: string; label: string; count: number }[] }

export function folderTree(tracks: Pick<Track, 'bpm' | 'mood'>[], grouping: Grouping): FolderGroup[] {
  const primaries: readonly string[] = grouping === 'bpm' ? BPM_RANGES : MOODS
  const secondaries: readonly string[] = grouping === 'bpm' ? MOODS : BPM_RANGES
  const groups: FolderGroup[] = []

  for (const primary of primaries) {
    const folders = secondaries
      .map((secondary) => {
        const id = `${primary}|${secondary}`
        return { id, label: secondary, count: tracks.filter((t) => folderOf(t, grouping) === id).length }
      })
      .filter((folder) => folder.count > 0)
    if (folders.length === 0) continue
    groups.push({ label: primary, count: folders.reduce((sum, f) => sum + f.count, 0), folders })
  }

  const unsorted = tracks.filter((t) => !t.mood).length
  if (unsorted > 0) {
    groups.push({
      label: 'Non classés',
      count: unsorted,
      folders: [{ id: UNSORTED, label: 'Ambiance à confirmer', count: unsorted }],
    })
  }
  return groups
}

export function trackSections(track: Track) {
  let start = 0
  return track.parts.map(([label, length, energy]) => {
    const section = { label, start: start / 100, end: (start + length) / 100, energy }
    start += length
    return section
  })
}

export function trackWave(track: Track) {
  return partsWave(trackSections(track), 160, track.id * 7.31)
}

// Cue's automatic placement: one hot cue at the start of each part.
export function defaultCues(track: Track): CueSlots {
  const slots: CueSlots = Array(PAD_COUNT).fill(null)
  trackSections(track)
    .slice(0, PAD_COUNT)
    .forEach((section, i) => {
      slots[i] = { label: section.label, position: section.start }
    })
  return slots
}

// Middle of the widest gap between existing cues: where a new cue gets in the way the least.
export function freeSpot(cues: CueSlots) {
  const positions = [0, 1, ...cues.flatMap((cue) => (cue ? [cue.position] : []))].sort((a, b) => a - b)
  let widest = 0
  let spot = 0.5
  for (let i = 1; i < positions.length; i++) {
    const gap = positions[i] - positions[i - 1]
    if (gap > widest) {
      widest = gap
      spot = (positions[i] + positions[i - 1]) / 2
    }
  }
  return spot
}

export function cueLetter(index: number) {
  return String.fromCharCode(65 + index)
}

export function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

export function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count > 1 ? pluralForm : singular}`
}
