// What was already set up for the key's tracks, elsewhere: in rekordbox (its USB export, read
// by CDJs) or in a rekordbox XML (the one Cue writes in CUE/, or a collection exported from
// rekordbox). Read only: Cue never touches these files.
import { cueLetter, MOODS, PAD_COUNT, sectionAt, type CueSlots, type Mood, type Track } from './model'
import { camelot } from './rhythm'
import type { KeyFile } from './usbKey'

export type ImportSource = 'rekordbox' | 'xml'

// Times in seconds. A field is missing when the source does not say.
export type Imported = {
  source: ImportSource
  // When the source file was last written: a newer edit in Cue wins over it.
  at: number
  title?: string
  artist?: string
  bpm?: number
  key?: string
  beat?: number
  downbeat?: number
  mood?: Mood
  // Pad index (0 = A) or -1 for a memory cue.
  cues?: { pad: number; label: string; time: number }[]
}

// ---- rekordbox USB export: PIONEER/USBANLZ/…/ANLZ0000.DAT and .EXT
// Layout from Deep Symmetry's reverse engineering (djl-analysis.deepsymmetry.org). Big-endian.

function utf16be(view: DataView, at: number, bytes: number) {
  let text = ''
  for (let i = 0; i + 1 < bytes; i += 2) {
    const code = view.getUint16(at + i)
    if (code === 0) break
    text += String.fromCharCode(code)
  }
  return text
}

type Anlz = { path?: string; grid?: { beat: number; tempo: number; time: number }[]; cues: Imported['cues'] & {} }

function parseAnlz(bytes: ArrayBuffer): Anlz {
  const view = new DataView(bytes)
  const tag = (at: number) => String.fromCharCode(...new Uint8Array(bytes, at, 4))
  const result: Anlz = { cues: [] }
  if (bytes.byteLength < 12 || tag(0) !== 'PMAI') return result

  for (let at = view.getUint32(4); at + 12 <= bytes.byteLength; ) {
    const kind = tag(at)
    const length = view.getUint32(at + 8)
    if (length < 12 || at + length > bytes.byteLength) break

    if (kind === 'PPTH') {
      result.path = utf16be(view, at + 0x10, view.getUint32(at + 0x0c))
    } else if (kind === 'PQTZ') {
      const count = view.getUint32(at + 0x14)
      result.grid = []
      for (let i = 0, entry = at + 0x18; i < count && entry + 8 <= at + length; i++, entry += 8) {
        result.grid.push({ beat: view.getUint16(entry), tempo: view.getUint16(entry + 2) / 100, time: view.getUint32(entry + 4) / 1000 })
      }
    } else if (kind === 'PCOB') {
      // Basic cue list (.DAT): no names.
      const count = view.getUint16(at + 0x12)
      for (let i = 0, entry = at + 0x18; i < count && entry + 0x38 <= at + length; i++, entry += 0x38) {
        if (tag(entry) !== 'PCPT') break
        const pad = view.getUint32(entry + 0x0c)
        result.cues.push({ pad: pad - 1, label: '', time: view.getUint32(entry + 0x20) / 1000 })
      }
    } else if (kind === 'PCO2') {
      // Extended cue list (.EXT): same cues, with the DJ's comments.
      const count = view.getUint16(at + 0x10)
      for (let i = 0, entry = at + 0x14; i < count && entry + 0x18 <= at + length; i++) {
        if (tag(entry) !== 'PCP2') break
        const size = view.getUint32(entry + 8)
        const pad = view.getUint32(entry + 0x0c)
        const commentLength = size >= 0x2c ? view.getUint32(entry + 0x28) : 0
        const label = commentLength && size >= 0x2c + commentLength ? utf16be(view, entry + 0x2c, commentLength) : ''
        result.cues.push({ pad: pad - 1, label, time: view.getUint32(entry + 0x14) / 1000 })
        if (size <= 0) break
        entry += size
      }
    }
    at += length
  }
  return result
}

function fromGrid(grid: Anlz['grid']): Pick<Imported, 'bpm' | 'beat' | 'downbeat'> {
  if (!grid?.length) return {}
  // The most common tempo: the one the track is played at.
  const counts = new Map<number, number>()
  for (const { tempo } of grid) counts.set(tempo, (counts.get(tempo) ?? 0) + 1)
  const bpm = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
  return { bpm, beat: grid[0].time, downbeat: grid.find((entry) => entry.beat === 1)?.time ?? grid[0].time }
}

// One .DAT/.EXT pair per track: the .EXT has the named cues, the .DAT the older list.
function mergeAnlz(dat: Anlz, ext: Anlz | null, at: number): Imported {
  const named = ext?.cues.length ? ext.cues : dat.cues
  // Unnamed memory and hot cues: keep the .DAT ones the .EXT does not repeat.
  const cues = [...named]
  for (const cue of dat.cues) {
    if (!cues.some((other) => other.pad === cue.pad && Math.abs(other.time - cue.time) < 0.01)) cues.push(cue)
  }
  return { source: 'rekordbox', at, ...fromGrid(dat.grid ?? ext?.grid), cues }
}

// Files under a folder, with their path from it.
async function* walk(dir: FileSystemDirectoryHandle, prefix = ''): AsyncGenerator<[string, FileSystemFileHandle]> {
  for await (const entry of dir.values()) {
    if (entry.kind === 'directory') yield* walk(entry, `${prefix}${entry.name}/`)
    else yield [prefix + entry.name, entry]
  }
}

async function child(dir: FileSystemDirectoryHandle, names: string[]) {
  try {
    let current = dir
    for (const name of names) current = await current.getDirectoryHandle(name)
    return current
  } catch {
    return null
  }
}

// By path of the audio file on the key, as rekordbox wrote it ("/Contents/…/track.mp3").
async function readRekordboxUsb(root: FileSystemDirectoryHandle) {
  const found = new Map<string, Imported>()
  const analysis = await child(root, ['PIONEER', 'USBANLZ'])
  if (!analysis) return found

  // ANLZ0000.DAT and ANLZ0000.EXT of one track sit in the same folder.
  const pairs = new Map<string, { dat?: FileSystemFileHandle; ext?: FileSystemFileHandle }>()
  for await (const [path, file] of walk(analysis)) {
    const match = /^(.*)\.(DAT|EXT)$/i.exec(path)
    if (!match) continue
    const pair = pairs.get(match[1]) ?? {}
    pair[match[2].toLowerCase() as 'dat' | 'ext'] = file
    pairs.set(match[1], pair)
  }

  for (const { dat, ext } of pairs.values()) {
    if (!dat) continue
    try {
      const datFile = await dat.getFile()
      const extFile = ext ? await ext.getFile() : null
      const parsedDat = parseAnlz(await datFile.arrayBuffer())
      const parsedExt = extFile ? parseAnlz(await extFile.arrayBuffer()) : null
      const path = parsedDat.path ?? parsedExt?.path
      if (!path) continue
      const at = Math.max(datFile.lastModified, extFile?.lastModified ?? 0)
      found.set(path.replace(/^\/+/, ''), mergeAnlz(parsedDat, parsedExt, at))
    } catch {
      // One unreadable analysis file does not stop the others.
    }
  }
  return found
}

// ---- rekordbox XML (DJ_PLAYLISTS)

// "Am", "F#m", "Db", or already Camelot ("8A").
export function toCamelot(tonality: string) {
  const value = tonality.trim()
  if (/^(1[0-2]|[1-9])[AB]$/i.test(value)) return value.toUpperCase()
  const match = /^([A-G])([#b♯♭]?)(m|min|minor)?$/i.exec(value)
  if (!match) return undefined
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1].toUpperCase() as 'C']
  const shift = /[#♯]/.test(match[2]) ? 1 : /[b♭]/.test(match[2]) ? -1 : 0
  return camelot((base + shift + 12) % 12, Boolean(match[3]))
}

// file://localhost/E:/Music/a%20b.mp3 → "E:/Music/a b.mp3"
function decodeLocation(location: string) {
  try {
    return decodeURIComponent(location.replace(/^file:\/\/(localhost)?\/?/i, '')).replace(/\\/g, '/')
  } catch {
    return location
  }
}

type XmlTrack = Imported & { location: string; size?: number }

export function parseRekordboxXml(text: string, at: number): XmlTrack[] {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror') || !doc.querySelector('DJ_PLAYLISTS')) return []
  return [...doc.querySelectorAll('COLLECTION > TRACK')].map((node) => {
    const number = (name: string, element: Element = node) => {
      const value = Number.parseFloat(element.getAttribute(name) ?? '')
      return Number.isFinite(value) ? value : undefined
    }
    const tempo = node.querySelector('TEMPO')
    const first = tempo ? number('Inizio', tempo) : undefined
    const tempoBpm = tempo ? number('Bpm', tempo) : undefined
    const position = tempo ? (number('Battito', tempo) ?? 1) : 1
    const comments = node.getAttribute('Comments') ?? ''
    const mood = MOODS.find((m) => comments.includes(`Ambiance : ${m}`))
    const bpm = number('AverageBpm') || tempoBpm

    return {
      source: 'xml' as const,
      at,
      location: decodeLocation(node.getAttribute('Location') ?? ''),
      size: number('Size'),
      title: node.getAttribute('Name') || undefined,
      artist: node.getAttribute('Artist') || undefined,
      bpm: bpm || undefined,
      key: toCamelot(node.getAttribute('Tonality') ?? ''),
      beat: first,
      // Battito: which beat of the bar the grid's first beat is.
      downbeat: first !== undefined && tempoBpm ? first + ((5 - position) % 4) * (60 / tempoBpm) : undefined,
      mood,
      cues: [...node.querySelectorAll('POSITION_MARK')]
        .filter((mark) => mark.getAttribute('Type') === '0')
        .map((mark) => ({
          pad: number('Num', mark) ?? -1,
          // Cue writes "A · Drop" on memory cues: keep the part name.
          label: (mark.getAttribute('Name') ?? '').replace(/^[A-H] · /, ''),
          time: number('Start', mark) ?? 0,
        })),
    }
  })
}

// A track of the XML is the key file whose path ends its location; if the key was mounted
// elsewhere, the same name and size.
export function matchFile(track: { location: string; size?: number }, files: KeyFile[]) {
  const location = track.location.toLowerCase()
  const byPath = files
    .filter((file) => location.endsWith(`/${file.path.toLowerCase()}`) || location === file.path.toLowerCase())
    .sort((a, b) => b.path.length - a.path.length)[0]
  if (byPath) return byPath
  const name = location.split('/').pop()
  return files.find((file) => file.name.toLowerCase() === name && (!track.size || file.size === track.size))
}

// ---- Everything found on the key, by path of the audio file in Cue's scan

async function xmlFiles(root: FileSystemDirectoryHandle) {
  const found: File[] = []
  for (const dir of [root, await child(root, ['CUE'])]) {
    if (!dir) continue
    for await (const entry of dir.values()) {
      if (entry.kind === 'file' && /\.xml$/i.test(entry.name)) found.push(await entry.getFile())
    }
  }
  return found
}

// Sources overlap (rekordbox USB has the grid and cues, the XML also titles and key): fields
// from the most recent source win, the others fill the gaps.
function overlay(base: Imported | undefined, next: Imported): Imported {
  if (!base) return next
  const [older, newer] = base.at <= next.at ? [base, next] : [next, base]
  const merged: Imported = { ...older }
  for (const [field, value] of Object.entries(newer)) {
    if (value !== undefined && !(field === 'cues' && (value as unknown[]).length === 0)) {
      ;(merged as Record<string, unknown>)[field] = value
    }
  }
  return merged
}

export async function readImports(root: FileSystemDirectoryHandle, files: KeyFile[]) {
  const imported: Record<string, Imported> = {}
  const mounts = new Map<string, number>()
  const add = (file: KeyFile | undefined, value: Imported) => {
    if (file) imported[file.path] = overlay(imported[file.path], value)
  }

  try {
    for (const [path, value] of await readRekordboxUsb(root)) add(matchFile({ location: `/${path}` }, files), value)
  } catch {
    // No rekordbox export, or unreadable: nothing to take.
  }
  for (const file of await xmlFiles(root).catch(() => [])) {
    for (const track of parseRekordboxXml(await file.text(), file.lastModified)) {
      const { location, size, ...value } = track
      const match = matchFile({ location, size }, files)
      add(match, value)
      // The XML knows where the key was mounted: its location minus the path on the key.
      if (match && location.toLowerCase().endsWith(match.path.toLowerCase())) {
        const prefix = location.slice(0, location.length - match.path.length)
        const mount = /^[A-Za-z]:/.test(prefix) ? prefix : `/${prefix}`
        mounts.set(mount, (mounts.get(mount) ?? 0) + 1)
      }
    }
  }
  // The most common one, if any.
  const mount = [...mounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  return { tracks: imported, mount }
}

// Cues from the key as pads. Hot cues keep their pad; a track with only memory cues (older
// CDJs) gets them on the pads in time order.
export function importedCues(
  track: Pick<Track, 'duration' | 'sections'>,
  cues: NonNullable<Imported['cues']>,
): CueSlots {
  const slots: CueSlots = Array(PAD_COUNT).fill(null)
  const hot = cues.filter((cue) => cue.pad >= 0 && cue.pad < PAD_COUNT)
  const placed = hot.length
    ? hot
    : cues
        .filter((cue) => cue.pad < 0)
        .sort((a, b) => a.time - b.time)
        .slice(0, PAD_COUNT)
        .map((cue, i) => ({ ...cue, pad: i }))
  for (const cue of placed) {
    const position = Math.min(0.999, Math.max(0, cue.time / track.duration))
    const label = cue.label.trim() || sectionAt(track, position) || `Cue ${cueLetter(cue.pad)}`
    slots[cue.pad] = { label, position }
  }
  return slots
}
