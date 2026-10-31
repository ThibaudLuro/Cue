import { useState } from 'react'
import {
  defaultCues,
  folderOf,
  folderTree,
  freeSpot,
  moveByBeats,
  MOODS,
  sectionAt,
  snapToGrid,
  trackFromFile,
  type Cue,
  type CueSlots,
  type Grouping,
  type Mood,
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
  keyCues: ImportSource | null
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
  const analysis = useTrackAnalysis(keyFiles)
  const { names, rename } = useTrackNames()
  const imported = useImports(key.root, keyFiles)
  // Where rekordbox will look for the files: from the key itself, else an earlier XML.
  const location = key.location || imported.mount || ''
  const [grouping, setGrouping] = useState<Grouping>('bpm')
  // null: show the folder of the selected track.
  const [pinnedFolder, setPinnedFolder] = useState<string | null>(null)
  const [trackId, setTrackId] = useState(keyFiles[0]?.path ?? '')
  const [cueIndex, setCueIndex] = useState(0)
  const cueEdits = useCueEdits()
  const [checked, setChecked] = useState<string[]>([])
  const [query, setQuery] = useState('')
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
    const sections = analysis.sections[file.path] ?? []
    const base = {
      ...t,
      title: name?.title ?? found?.title ?? t.title,
      artist: name?.artist ?? found?.artist ?? t.artist,
      bpm: found?.bpm ?? rhythm?.bpm ?? null,
      key: found?.key ?? rhythm?.key ?? '—',
      sections,
      beat: found?.beat ?? rhythm?.beat ?? null,
      // The intro's cue sits on the first downbeat.
      downbeat: found?.downbeat ?? (sections[0] && decoded ? sections[0].cue * decoded : null),
      mood: correction ?? found?.mood ?? guess?.mood ?? null,
      energy: guess?.energy ?? 0,
      confidence: correction ? 'choisie par vous' : found?.mood ? 'reprise de la clé' : (guess?.confidence ?? t.confidence),
      analysis: analysis.state(file.path),
      // Cues found on the key for this track, whether shown or not.
      keyCues: found?.cues?.length ? found.source : null,
    }
    const edit = cueEdits.edits[t.id]
    const keyCues = found?.cues?.length && base.duration ? importedCues(base, found.cues) : null
    if (edit && (!keyCues || edit.at >= (found?.at ?? 0))) return { ...base, cues: edit.cues, cueSource: 'edit' }
    if (keyCues && found) return { ...base, cues: keyCues, cueSource: found.source }
    return { ...base, cues: defaultCues(sections), cueSource: 'auto' }
  })
  const tree = folderTree(tracks, grouping)

  const track = tracks.find((t) => t.id === trackId) ?? tracks[0]
  const folder = pinnedFolder ?? folderOf(track, grouping)
  const search = query.trim().toLowerCase()
  const visible = search
    ? tracks.filter((t) => `${t.title} ${t.artist} ${t.mood ?? ''}`.toLowerCase().includes(search))
    : tracks.filter((t) => folderOf(t, grouping) === folder)
  const allChecked = visible.length > 0 && visible.every((t) => checked.includes(t.id))
  const activeCue = track.cues[cueIndex] ? cueIndex : track.cues.findIndex(Boolean)
  const file = keyFiles.find((candidate) => candidate.path === track.id)
  const player = usePlayer(file)
  const waveform = useWaveform(file)

  const sortedTracks = tracks.filter((t) => t.mood)
  const cuesToWrite = tracks.reduce((sum, t) => sum + t.cues.filter(Boolean).length, 0)

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

  function placeCue(index: number, position: number, snap: boolean) {
    const spot = snap ? snapToGrid(track, position) : Math.min(0.999, Math.max(0, position))
    const label = sectionAt(track, spot) ?? 'Repère'
    setTrackCues(track.cues.map((cue, i) => (i === index ? { label, position: spot } : cue)))
    setCueIndex(index)
  }

  function dropCueEdits(ids: string[]) {
    cueEdits.drop(ids)
    setCueIndex(0)
    markDirty()
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
      setPinnedFolder(null)
      markDirty()
    },
    openFolder(id: string) {
      const first = tracks.find((t) => folderOf(t, grouping) === id)
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
      if (search && picked) setPinnedFolder(folderOf(picked, grouping))
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
      setPinnedFolder(null)
      markDirty()
    },
    renameTrack(field: NameField, value: string) {
      if (value.trim() === track[field]) return
      rename(track.id, field, value)
      markDirty()
    },
    changeMood(mood: Mood) {
      analysis.correct([track.id], mood)
      setPinnedFolder(null)
      markDirty()
    },

    resetVisibleCues() {
      dropCueEdits(visible.map((t) => t.id))
    },
    resetTrackCues() {
      // Edited here: back to what the key says (or the automatic placement). Taken from the key:
      // the automatic placement instead, as an edit.
      if (track.cueSource === 'edit') dropCueEdits([track.id])
      else setTrackCues(defaultCues(track.sections))
    },
    selectCue(index: number) {
      setCueIndex(index)
      // Like a hot cue on a deck: jump to it.
      const cue = track.cues[index]
      if (cue) player.seek(cue.position)
    },
    // Empty pad: like on a CDJ, the cue goes where the music is playing (or was paused),
    // on the nearest beat. Before any playback, in the widest gap between existing cues.
    addCue(index: number) {
      const listened = player.playing || player.time > 0
      placeCue(index, listened ? player.position : freeSpot(track.cues), true)
    },
    // Double-click on the waveform: the first free pad, at that spot.
    addCueAt(position: number, snap: boolean) {
      const index = track.cues.findIndex((cue) => !cue)
      if (index < 0) return false
      placeCue(index, position, snap)
      return true
    },
    // Drag on the waveform; snap to the beat unless the DJ holds Alt.
    moveCue(index: number, position: number, snap: boolean) {
      setTrackCues(
        track.cues.map((cue, i) =>
          cue && i === index ? { ...cue, position: snap ? snapToGrid(track, position) : position } : cue,
        ),
      )
      setCueIndex(index)
    },
    cueToPlayhead() {
      editActiveCue((cue) => ({ ...cue, position: snapToGrid(track, player.position) }))
    },
    renameCue(label: string) {
      editActiveCue((cue) => ({ ...cue, label }))
    },
    nudgeCue(beats: number) {
      editActiveCue((cue) => ({ ...cue, position: moveByBeats(track, cue.position, beats) }))
    },
    deleteCue() {
      setTrackCues(track.cues.map((cue, i) => (i === activeCue ? null : cue)))
      setCueIndex(0)
    },

    // Writes CUE/rekordbox.xml on the key: tracks with their grid, key and hot cues, and one
    // playlist per folder of the sidebar.
    async save() {
      if (status === 'saving') return
      setToast(false)
      setSaveError(null)
      if (!location) {
        setSaveError('Choisissez la lettre de la clé (carte de la clé, à gauche) pour que rekordbox retrouve les morceaux.')
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
        setSaveError('L’écriture sur la clé a échoué. Vérifiez qu’elle est branchée et n’est pas verrouillée en écriture.')
      }
    },
    closeToast() {
      setToast(false)
    },
  }
}
