// rekordbox XML export ("DJ_PLAYLISTS"): the format rekordbox imports from other tools.
// Once imported, rekordbox exports the tracks to the key with their grid and hot cues,
// in the database CDJs read.
import { cueLetter, type CueSlots, type Mood } from './model'

export type ExportTrack = {
  // Path on the key, from its root.
  path: string
  title: string
  artist: string
  size: number
  // Seconds, as decoded: hot cue positions are fractions of it.
  duration: number
  bpm: number | null
  // Camelot ("8A").
  key: string | null
  // Seconds: one beat of the grid, and one downbeat (first beat of a bar).
  beat: number | null
  downbeat: number | null
  mood: Mood | null
  energy: number
  cues: CueSlots
}

export type ExportPlaylist = { folder: string; name: string; paths: string[] }

const KINDS: Record<string, string> = { mp3: 'MP3 File', wav: 'WAV File', flac: 'FLAC File', aif: 'AIFF File', aiff: 'AIFF File' }

// rekordbox stores keys in classic notation.
const CLASSIC: Record<string, string> = {
  '1A': 'Abm', '2A': 'Ebm', '3A': 'Bbm', '4A': 'Fm', '5A': 'Cm', '6A': 'Gm',
  '7A': 'Dm', '8A': 'Am', '9A': 'Em', '10A': 'Bm', '11A': 'F#m', '12A': 'Dbm',
  '1B': 'B', '2B': 'F#', '3B': 'Db', '4B': 'Ab', '5B': 'Eb', '6B': 'Bb',
  '7B': 'F', '8B': 'C', '9B': 'G', '10B': 'D', '11B': 'A', '12B': 'E',
}

// Hot cue colours on the CDJ, by kind of part.
const CUE_COLOURS: [RegExp, [number, number, number]][] = [
  [/^Drop/, [255, 106, 0]],
  [/^Montée/, [255, 200, 0]],
  [/^Break/, [48, 90, 255]],
  [/^(Intro|Outro)/, [40, 226, 20]],
]
const DEFAULT_COLOUR: [number, number, number] = [200, 200, 200]

function escape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function attributes(values: Record<string, string | number | undefined>) {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([name, value]) => `${name}="${escape(String(value))}"`)
    .join(' ')
}

// root: where the key is on the computer that will run rekordbox, e.g. "E:/" or "/Volumes/CUE_USB/".
export function location(root: string, path: string) {
  const base = root.replace(/\\/g, '/').replace(/\/?$/, '/')
  const encoded = (base + path)
    .split('/')
    .map((segment, i) => (i === 0 && /^[A-Za-z]:$/.test(segment) ? segment : encodeURIComponent(segment)))
    .join('/')
  return `file://localhost${encoded.startsWith('/') ? '' : '/'}${encoded}`
}

function seconds(value: number) {
  return value.toFixed(3)
}

function trackXml(track: ExportTrack, id: number, root: string) {
  const extension = track.path.split('.').pop()?.toLowerCase() ?? ''
  const comments = [track.mood && `Ambiance : ${track.mood}`, track.energy > 0 && `Énergie ${track.energy}/5`]
    .filter(Boolean)
    .join(' · ')
  const head = attributes({
    TrackID: id,
    Name: track.title,
    Artist: track.artist,
    Kind: KINDS[extension],
    Size: track.size,
    TotalTime: Math.round(track.duration),
    AverageBpm: track.bpm ? track.bpm.toFixed(2) : undefined,
    Tonality: track.key ? CLASSIC[track.key] : undefined,
    Comments: comments,
    Location: location(root, track.path),
  })

  const children: string[] = []
  if (track.bpm && track.beat !== null) {
    // The grid: the first beat of the track and where it falls in its bar (1 to 4).
    const beatLength = 60 / track.bpm
    const first = ((track.beat % beatLength) + beatLength) % beatLength
    const reference = track.downbeat ?? track.beat
    const index = Math.round((first - reference) / beatLength)
    children.push(`<TEMPO ${attributes({ Inizio: seconds(first), Bpm: track.bpm.toFixed(2), Metro: '4/4', Battito: (((index % 4) + 4) % 4) + 1 })}/>`)
  }
  track.cues.forEach((cue, i) => {
    if (!cue) return
    const start = seconds(cue.position * track.duration)
    const [red, green, blue] = CUE_COLOURS.find(([pattern]) => pattern.test(cue.label))?.[1] ?? DEFAULT_COLOUR
    // Hot cue on pad A–H…
    children.push(`<POSITION_MARK ${attributes({ Name: cue.label, Type: 0, Start: start, Num: i, Red: red, Green: green, Blue: blue })}/>`)
    // …and the same spot as a memory cue, for decks without hot cues.
    children.push(`<POSITION_MARK ${attributes({ Name: `${cueLetter(i)} · ${cue.label}`, Type: 0, Start: start, Num: -1 })}/>`)
  })

  return children.length
    ? `    <TRACK ${head}>\n${children.map((child) => `      ${child}`).join('\n')}\n    </TRACK>`
    : `    <TRACK ${head}/>`
}

export function rekordboxXml(tracks: ExportTrack[], playlists: ExportPlaylist[], root: string, setName: string) {
  const ids = new Map(tracks.map((track, i) => [track.path, i + 1]))

  // Folders of playlists, in the order they come.
  const folders: { name: string; playlists: ExportPlaylist[] }[] = []
  for (const playlist of playlists) {
    const folder = folders.find((f) => f.name === playlist.folder)
    if (folder) folder.playlists.push(playlist)
    else folders.push({ name: playlist.folder, playlists: [playlist] })
  }
  const playlistXml = (playlist: ExportPlaylist) =>
    [
      `          <NODE ${attributes({ Name: playlist.name, Type: 1, KeyType: 0, Entries: playlist.paths.length })}>`,
      ...playlist.paths.map((path) => `            <TRACK Key="${ids.get(path)}"/>`),
      '          </NODE>',
    ].join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<DJ_PLAYLISTS Version="1.0.0">',
    '  <PRODUCT Name="Cue" Version="1.0" Company="Cue"/>',
    `  <COLLECTION Entries="${tracks.length}">`,
    ...tracks.map((track, i) => trackXml(track, i + 1, root)),
    '  </COLLECTION>',
    '  <PLAYLISTS>',
    '    <NODE Type="0" Name="ROOT" Count="1">',
    `      <NODE ${attributes({ Type: 0, Name: setName, Count: folders.length })}>`,
    ...folders.flatMap((folder) => [
      `        <NODE ${attributes({ Type: 0, Name: folder.name, Count: folder.playlists.length })}>`,
      ...folder.playlists.map(playlistXml),
      '        </NODE>',
    ]),
    '      </NODE>',
    '    </NODE>',
    '  </PLAYLISTS>',
    '</DJ_PLAYLISTS>',
    '',
  ].join('\n')
}
