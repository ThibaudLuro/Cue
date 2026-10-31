import type { Bar } from '../lib/waveform'
import type { Wave } from './audio'
import type { Section } from './structure'

export const MOODS = ['Nocturne', 'Aérien', 'Mélodique', 'Solaire', 'Hypnotique', 'Sombre', 'Énergique'] as const
export type Mood = (typeof MOODS)[number]

export const BPM_RANGES = ['Moins de 118 BPM', '118–121 BPM', '122–125 BPM', '126–129 BPM', '130+ BPM', 'BPM inconnu'] as const

export type Grouping = 'bpm' | 'mood'


export type Track = {
  // Path of the file on the key: stays the same across re-reads.
  id: string
  title: string
  artist: string
  // null until the track is analysed.
  bpm: number | null
  key: string
  mood: Mood | null
  energy: number
  duration: number
  // Beat grid, in seconds: one beat and one downbeat (first beat of a bar). null until analysed.
  beat: number | null
  downbeat: number | null
  // Its parts, found by the analysis (structure.ts); empty until then.
  sections: Section[]
  confidence: string
}

// position goes from 0 (start of the track) to 1 (end).
export type Cue = { label: string; position: number }
export type CueSlots = (Cue | null)[]

export const PAD_COUNT = 8
export const UNSORTED = 'unsorted'

// A file read on the key, not analysed yet: what the file name tells is all we know.
// "Artist - Title.mp3" is the usual naming; otherwise the folder stands in for the artist.
export function trackFromFile(path: string, duration: number): Track {
  const segments = path.split('/')
  const base = segments[segments.length - 1].replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim()
  const dash = base.indexOf(' - ')
  const artist = dash > 0 ? base.slice(0, dash).trim() : (segments[segments.length - 2] ?? 'Artiste inconnu')
  const title = dash > 0 ? base.slice(dash + 3).trim() : base

  return {
    id: path,
    title,
    artist,
    bpm: null,
    key: '—',
    mood: null,
    energy: 0,
    duration,
    beat: null,
    downbeat: null,
    sections: [],
    confidence: 'à analyser',
  }
}

function bpmRange(bpm: number | null) {
  if (bpm === null) return BPM_RANGES[5]
  if (bpm < 118) return BPM_RANGES[0]
  if (bpm < 122) return BPM_RANGES[1]
  if (bpm < 126) return BPM_RANGES[2]
  if (bpm < 130) return BPM_RANGES[3]
  return BPM_RANGES[4]
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

export function folderPath(track: Pick<Track, 'bpm' | 'mood'>, grouping: Grouping, keyName: string) {
  const folder = folderOf(track, grouping)
  const segments = folder === UNSORTED ? ['Non classés'] : folderSegments(folder)
  return [keyName, ...segments].join(' / ') + ' /'
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


// The waveform as drawn: count bars, each the loudest of its points. Colour follows the mean
// level, so drops stand out from breaks.
export function waveBars(wave: Wave, count = 160): Bar[] {
  const group = wave.peaks.length / count
  return Array.from({ length: count }, (_, i) => {
    const start = Math.floor(i * group)
    const end = Math.max(start + 1, Math.floor((i + 1) * group))
    const peak = Math.max(...wave.peaks.slice(start, end))
    const level = Math.max(...wave.rms.slice(start, end))
    return { height: Math.max(0.04, peak / 100), level: level >= 75 ? 'high' : level >= 45 ? 'mid' : 'low' }
  })
}

// Cue's automatic placement: one hot cue at the start of each part, on its first downbeat.
export function defaultCues(sections: Section[]): CueSlots {
  const slots: CueSlots = Array(PAD_COUNT).fill(null)
  sections
    .slice(0, PAD_COUNT)
    .forEach((section, i) => {
      slots[i] = { label: section.label, position: section.cue }
    })
  return slots
}


export function cueLetter(index: number) {
  return String.fromCharCode(65 + index)
}

export function formatBytes(bytes: number) {
  const units = ['o', 'Ko', 'Mo', 'Go', 'To']
  let value = bytes
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit++
  }
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: unit > 2 ? 1 : 0 })} ${units[unit]}`
}

export function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

export function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

// ---- Hot cue placement

// Without an analysed tempo, moves still go by beats of a typical house tempo, unsnapped.
const FALLBACK_BPM = 124

function clampPosition(position: number) {
  return Math.min(0.999, Math.max(0, position))
}

// Snaps a position to the nearest beat (or bar) of the track's grid, like rekordbox's quantize.
export function snapToGrid(track: Track, position: number, unit: 'beat' | 'bar' = 'beat') {
  if (!track.bpm || track.beat === null || !track.duration) return clampPosition(position)
  const length = (unit === 'bar' ? 240 : 60) / track.bpm
  const anchor = unit === 'bar' ? (track.downbeat ?? track.beat) : track.beat
  const time = position * track.duration
  return clampPosition((anchor + Math.round((time - anchor) / length) * length) / track.duration)
}

// Moves by whole beats, landing on the grid even if the cue was off it.
export function moveByBeats(track: Track, position: number, beats: number) {
  if (!track.duration) return position
  const beat = 60 / (track.bpm ?? FALLBACK_BPM) / track.duration
  return snapToGrid(track, position + beats * beat)
}

// Bar and beat on the grid ("mesure 33.1"), counted from the first downbeat.
export function barBeat(track: Track, position: number) {
  if (!track.bpm || track.beat === null || !track.duration) return null
  const beatLength = 60 / track.bpm
  const anchor = track.downbeat ?? track.beat
  const beats = Math.round((position * track.duration - anchor) / beatLength)
  return { bar: Math.floor(beats / 4) + 1, beat: (((beats % 4) + 4) % 4) + 1 }
}

// The part a position falls in: a new cue is named after it.
export function sectionAt(track: Pick<Track, 'sections'>, position: number) {
  return track.sections.find((section) => position >= section.start && position < section.end)?.label ?? null
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

// Precise time for cues: "1:23.45".
export function formatCueTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds - minutes * 60
  return `${minutes}:${rest.toFixed(2).padStart(5, '0')}`
}
