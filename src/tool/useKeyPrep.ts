import { useState } from 'react'
import {
  defaultCues,
  folderOf,
  folderTree,
  ALL_TRACKS,
  freeSpot,
  moveByBeats,
  MOODS,
  sortTracks,
  sectionAt,
  clampPosition,
  trackFromFile,
  type Cue,
  type CueSlots,
  type Grouping,
  type Mood,
  type Sort,
  type SortKey,
  type Track,
} from './model'
import { importedCues, type ImportSource } from './imports'
import { rekordboxXml, type ExportPlaylist, type ExportTrack } from './rekordbox'
import type { KeyFile } from './usbKey'
import { useTrackAnalysis, type AnalysisState } from './useTrackAnalysis'
import { usePlayer } from './usePlayer'
import { useWaveform } from './useWaveform'
import { useCueEdits } from './useCueEdits'
import { useImports } from './useImports'
import { useTrackNames, type NameField } from './useTrackNames'
import type { UsbKey } from './useUsbKey'

// Where the hot cues shown come from.
export type CueSource = 'edit' | ImportSource | 'auto'
export type KeyTrack = Track & {
  cues: CueSlots
  cueSource: CueSource
  analysis: AnalysisState
}
export type SaveStatus = 'pending' | 'saving' | 'saved'
export type KeyPrep = ReturnType<typeof useKeyPrep>

const NO_FILES: KeyFile[] = []

// State of the "prepare my key" screen: real files, analysis and rekordbox export.
export function useKeyPrep(key: UsbKey) {
  const { files, durations } = key
  // The workspace only shows up once the key is read.
  const keyFiles = files ?? NO_FILES
  const { names, rename } = useTrackNames()
  const imported = useImports(key.root, keyFiles)
  // A track the key already has a grid, a key or cues for keeps them: no automatic analysis.
  const setups = imported.ready
    ? Object.entries(imported.tracks)
        .filter(([, found]) => found.bpm || found.key || found.cues?.length)
        .map(([path]) => path)
    : null
  const analysis = useTrackAnalysis(keyFiles, setups)
  // Where rekordbox will look for the files: from the key itself, else an earlier XML.
  const location = key.location || imported.mount || ''
  const [grouping, setGrouping] = useState<Grouping>('bpm')
  // null: show the folder of the selected track. The whole library to start with.
  const [pinnedFolder, setPinnedFolder] = useState<string | null>(ALL_TRACKS)
  const [trackId, setTrackId] = useState(keyFiles[0]?.path ?? '')
  const [cueIndex, setCueIndex] = useState(0)
  const cueEdits = useCueEdits()
  const [checked, setChecked] = useState<string[]>([])
  const [query, setQuery] = useState('')
  // null: the order of the files on the stick.
  const [sort, setSort] = useState<Sort | null>(null)
  const [status, setStatus] = useState<SaveStatus>('pending')
  const [progress, setProgress] = useState(0)
  const [toast, setToast] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Who wins: what the DJ did in Cue, then what is on the key (rekordbox export or XML), then
  // the analysis. For hot cues, the most recent of Cue and the key.
  const tracks: KeyTrack[] = keyFiles.map((file) => {
    // Cue positions are fractions of the decoded length: prefer it to the player's.
    const decoded = analysis.analyses[file.path]?.duration
    const t = trackFromFile(file.path, decoded || durations[file.path] || 0)
    const guess = analysis.guesses[file.path]
    const correction = analysis.corrections[file.path]
    const rhythm = analysis.analyses[file.path]?.rhythm
    const name = names[file.path]
    const found = imported.tracks[file.path]
    // A fresh analysis the DJ asked for replaces what the key had (but not the names).
    const manual = analysis.analyses[file.path]?.manual ?? 0
    const setup = found && found.at >= manual ? found : undefined
    const sections = analysis.sections[file.path] ?? []
    const mood = correction ?? setup?.mood ?? guess?.mood ?? null
    const base = {
      ...t,
      title: name?.title ?? found?.title ?? t.title,
      artist: name?.artist ?? found?.artist ?? t.artist,
      bpm: setup?.bpm ?? rhythm?.bpm ?? null,
      key: setup?.key ?? rhythm?.key ?? '—',
      sections,
      beat: setup?.beat ?? rhythm?.beat ?? null,
      // The intro's cue sits on the first downbeat.
      downbeat: setup?.downbeat ?? (sections[0] && decoded ? sections[0].cue * decoded : null),
      mood,
      // The level is the energy: corrected or found on the key, it wins over the guess.
      energy: mood ? MOODS.indexOf(mood) + 1 : (guess?.energy ?? 0),
      confidence: correction ? 'set by you' : setup?.mood ? 'from the stick' : (guess?.confidence ?? t.confidence),
      analysis: analysis.state(file.path),
    }
    const edit = cueEdits.edits[t.id]
    const keyCues = setup?.cues?.length && base.duration ? importedCues(base, setup.cues) : null
    // Cues moved by the DJ win, unless a newer setup or analysis came after them.
    if (edit && edit.at > manual && (!keyCues || edit.at >= (setup?.at ?? 0))) return { ...base, cues: edit.cues, cueSource: 'edit' }
    if (keyCues && setup) return { ...base, cues: keyCues, cueSource: setup.source }
    return { ...base, cues: defaultCues(sections), cueSource: 'auto' }
  })
  const tree = folderTree(tracks, grouping)

  const track = tracks.find((t) => t.id === trackId) ?? tracks[0]
  const folder = pinnedFolder ?? folderOf(track, grouping)
  const search = query.trim().toLowerCase()
  const filtered = search
    ? tracks.filter((t) => `${t.title} ${t.artist} ${t.mood ?? ''}`.toLowerCase().includes(search))
    : folder === ALL_TRACKS
      ? tracks
      : tracks.filter((t) => folderOf(t, grouping) === folder)
  const visible = sortTracks(filtered, sort)
  const allChecked = visible.length > 0 && visible.every((t) => checked.includes(t.id))
  const activeCue = track.cues[cueIndex] ? cueIndex : track.cues.findIndex(Boolean)
  const file = keyFiles.find((candidate) => candidate.path === track.id)
  const player = usePlayer(file)
  const waveform = useWaveform(file)

  const sortedTracks = tracks.filter((t) => t.mood)
  const cuesToWrite = tracks.reduce((sum, t) => sum + t.cues.filter(Boolean).length, 0)

  // After a change that moves tracks, show the selected track's new folder; the whole library
  // stays as it is.
  function followTrack() {
    setPinnedFolder((current) => (current === ALL_TRACKS ? current : null))
  }

  // Any edit makes the key out of date again.
  function markDirty() {
    setStatus('pending')
    setToast(false)
  }

  function setTrackCues(cues: CueSlots) {
    cueEdits.set(track.id, cues)
    markDirty()
  }

  function editActiveCue(change: (cue: Cue) => Cue) {
    setTrackCues(track.cues.map((cue, i) => (cue && i === activeCue ? change(cue) : cue)))
  }

  // Exactly where the DJ puts it: no quantize.
  function placeCue(index: number, position: number) {
    const spot = clampPosition(position)
    const label = sectionAt(track, spot) ?? 'Cue'
    setTrackCues(track.cues.map((cue, i) => (i === index ? { label, position: spot } : cue)))
    setCueIndex(index)
  }

  return {
    key,
    location,
    analysis: analysis.progress,
    player,
    waveform,
    tracks,
    tree,
    track,
    folder,
    visible,
    grouping,
    query,
    sort,
    isSearching: search !== '',
    checked,
    allChecked,
    activeCue,
    status,
    progress,
    toast,
    saveError,
    sortedCount: sortedTracks.length,
    unsortedCount: tracks.length - sortedTracks.length,
    cuesToWrite,

    changeGrouping(next: Grouping) {
      setGrouping(next)
      followTrack()
      markDirty()
    },
    openFolder(id: string) {
      const first = id === ALL_TRACKS ? tracks[0] : tracks.find((t) => folderOf(t, grouping) === id)
      setPinnedFolder(id)
      if (first) setTrackId(first.id)
      setCueIndex(0)
      setQuery('')
      setChecked([])
    },
    selectTrack(id: string) {
      setTrackId(id)
      setCueIndex(0)
      const picked = tracks.find((t) => t.id === id)
      if (search && picked && pinnedFolder !== ALL_TRACKS) setPinnedFolder(folderOf(picked, grouping))
    },
    // Click on a column: ascending, then descending, then back to the stick's order.
    sortBy(key: SortKey) {
      setSort((current) =>
        current?.key !== key ? { key, descending: false } : current.descending ? null : { key, descending: true },
      )
    },
    search(value: string) {
      setQuery(value)
      setChecked([])
    },

    toggleChecked(id: string) {
      setChecked((ids) => (ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id]))
    },
    toggleAll() {
      setChecked(allChecked ? [] : visible.map((t) => t.id))
    },
    clearChecked() {
      setChecked([])
    },
    moodForChecked(value: string) {
      const mood = MOODS.find((m) => m === value)
      if (!mood) return
      analysis.correct(checked, mood)
      setChecked([])
      followTrack()
      markDirty()
    },
    renameTrack(field: NameField, value: string) {
      if (value.trim() === track[field]) return
      rename(track.id, field, value)
      markDirty()
    },
    changeMood(mood: Mood) {
      analysis.correct([track.id], mood)
      followTrack()
      markDirty()
    },

    // Fresh analysis of these tracks, even those the key already had a setup for.
    reanalyse(ids: string[]) {
      analysis.reanalyse(ids)
      markDirty()
    },
    reanalyseChecked() {
      analysis.reanalyse(checked)
      setChecked([])
      markDirty()
    },
    selectCue(index: number) {
      setCueIndex(index)
      // Like a hot cue on a deck: jump to it.
      const cue = track.cues[index]
      if (cue) player.seek(cue.position)
    },
    // Empty pad: like on a CDJ, the cue goes where the music is playing (or was paused),
    // exactly. Before any playback, in the widest gap between existing cues.
    addCue(index: number) {
      const listened = player.playing || player.time > 0
      placeCue(index, listened ? player.position : freeSpot(track.cues))
    },
    // Double-click on the waveform: the first free pad, at that spot.
    addCueAt(position: number) {
      const index = track.cues.findIndex((cue) => !cue)
      if (index < 0) return false
      placeCue(index, position)
      return true
    },
    // Drag on the waveform.
    moveCue(index: number, position: number) {
      setTrackCues(
        track.cues.map((cue, i) =>
          cue && i === index ? { ...cue, position: clampPosition(position) } : cue,
        ),
      )
      setCueIndex(index)
    },
    renameCue(index: number, label: string) {
      setTrackCues(track.cues.map((cue, i) => (cue && i === index ? { ...cue, label } : cue)))
    },
    nudgeCue(beats: number) {
      editActiveCue((cue) => ({ ...cue, position: moveByBeats(track, cue.position, beats) }))
    },
    deleteCue(index: number) {
      setTrackCues(track.cues.map((cue, i) => (i === index ? null : cue)))
      if (index === activeCue) setCueIndex(0)
    },

    // Writes CUE/rekordbox.xml on the key: tracks with their grid, key and hot cues, and one
    // playlist per folder of the sidebar.
    async save() {
      if (status === 'saving') return
      setToast(false)
      setSaveError(null)
      if (!location) {
        setSaveError('Pick the stick’s drive letter (stick card, on the left) so rekordbox can find the tracks.')
        return
      }
      setProgress(0)
      setStatus('saving')
      try {
        const exported: ExportTrack[] = tracks.map((t) => {
          const analysed = analysis.analyses[t.id]
          // Hot cues are fractions of the decoded length.
          const duration = analysed?.duration || t.duration
          return {
            path: t.id,
            title: t.title,
            artist: t.artist,
            size: keyFiles.find((f) => f.path === t.id)?.size ?? 0,
            duration,
            bpm: t.bpm,
            key: t.key === '—' ? null : t.key,
            beat: t.beat,
            downbeat: t.downbeat,
            mood: t.mood,
            energy: t.energy,
            cues: t.cues,
          }
        })
        setProgress(40)
        const playlists: ExportPlaylist[] = tree.flatMap((group) =>
          group.folders.map((f) => ({
            folder: group.label,
            name: f.label,
            paths: tracks.filter((t) => folderOf(t, grouping) === f.id).map((t) => t.id),
          })),
        )
        await key.write(['CUE', 'rekordbox.xml'], rekordboxXml(exported, playlists, location, `Cue · ${key.name}`))
        setProgress(100)
        setStatus('saved')
        setToast(true)
      } catch {
        setStatus('pending')
        setSaveError('Writing to the stick failed. Check that it is plugged in and not write-protected.')
      }
    },
    closeToast() {
      setToast(false)
    },
  }
}
