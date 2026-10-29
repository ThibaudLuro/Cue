import { useEffect, useMemo, useState } from 'react'
import {
  defaultCues,
  folderOf,
  folderTree,
  freeSpot,
  KEY_TRACKS,
  MOODS,
  type Cue,
  type CueSlots,
  type Grouping,
  type Mood,
  type Track,
} from './model'

export type KeyTrack = Track & { cues: CueSlots }
export type SaveStatus = 'pending' | 'saving' | 'saved'
export type KeyPrep = ReturnType<typeof useKeyPrep>

// State of the "prepare my key" screen. Everything is mock: the key, the analysis and the write.
export function useKeyPrep() {
  const [grouping, setGrouping] = useState<Grouping>('bpm')
  // null: show the folder of the selected track.
  const [pinnedFolder, setPinnedFolder] = useState<string | null>(null)
  const [trackId, setTrackId] = useState(KEY_TRACKS[0].id)
  const [cueIndex, setCueIndex] = useState(0)
  const [moodEdits, setMoodEdits] = useState<Record<number, Mood>>({})
  const [cueEdits, setCueEdits] = useState<Record<number, CueSlots>>({})
  const [checked, setChecked] = useState<number[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<SaveStatus>('pending')
  const [progress, setProgress] = useState(0)
  const [toast, setToast] = useState(false)
  const [rereading, setRereading] = useState(false)

  // Simulated write to the key.
  useEffect(() => {
    if (status !== 'saving') return
    let value = 0
    const timer = setInterval(() => {
      value = Math.min(100, value + 7)
      setProgress(value)
      if (value === 100) {
        clearInterval(timer)
        setStatus('saved')
        setToast(true)
      }
    }, 110)
    return () => clearInterval(timer)
  }, [status])

  // Simulated re-read of the key.
  useEffect(() => {
    if (!rereading) return
    const timer = setTimeout(() => setRereading(false), 1200)
    return () => clearTimeout(timer)
  }, [rereading])

  const tracks = useMemo<KeyTrack[]>(
    () =>
      KEY_TRACKS.map((t) => ({
        ...t,
        mood: moodEdits[t.id] ?? t.mood,
        cues: cueEdits[t.id] ?? defaultCues(t),
      })),
    [moodEdits, cueEdits],
  )
  const tree = useMemo(() => folderTree(tracks, grouping), [tracks, grouping])

  const track = tracks.find((t) => t.id === trackId) ?? tracks[0]
  const folder = pinnedFolder ?? folderOf(track, grouping)
  const search = query.trim().toLowerCase()
  const visible = search
    ? tracks.filter((t) => `${t.title} ${t.artist} ${t.mood ?? ''}`.toLowerCase().includes(search))
    : tracks.filter((t) => folderOf(t, grouping) === folder)
  const allChecked = visible.length > 0 && visible.every((t) => checked.includes(t.id))
  const activeCue = track.cues[cueIndex] ? cueIndex : track.cues.findIndex(Boolean)

  const sortedTracks = tracks.filter((t) => t.mood)
  const cuesToWrite = sortedTracks.reduce((sum, t) => sum + t.cues.filter(Boolean).length, 0)

  // Any edit makes the key out of date again.
  function markDirty() {
    setStatus('pending')
    setToast(false)
  }

  function setTrackCues(cues: CueSlots) {
    setCueEdits((edits) => ({ ...edits, [track.id]: cues }))
    markDirty()
  }

  function editActiveCue(change: (cue: Cue) => Cue) {
    setTrackCues(track.cues.map((cue, i) => (cue && i === activeCue ? change(cue) : cue)))
  }

  function dropCueEdits(ids: number[]) {
    setCueEdits((edits) => Object.fromEntries(Object.entries(edits).filter(([id]) => !ids.includes(Number(id)))))
    setCueIndex(0)
    markDirty()
  }

  return {
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
    rereading,
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
    selectTrack(id: number) {
      setTrackId(id)
      setCueIndex(0)
      const picked = tracks.find((t) => t.id === id)
      if (search && picked) setPinnedFolder(folderOf(picked, grouping))
    },
    search(value: string) {
      setQuery(value)
      setChecked([])
    },

    toggleChecked(id: number) {
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
      setMoodEdits((edits) => ({ ...edits, ...Object.fromEntries(checked.map((id) => [id, mood])) }))
      setChecked([])
      setPinnedFolder(null)
      markDirty()
    },
    changeMood(mood: Mood) {
      setMoodEdits((edits) => ({ ...edits, [track.id]: mood }))
      setPinnedFolder(null)
      markDirty()
    },

    resetVisibleCues() {
      dropCueEdits(visible.map((t) => t.id))
    },
    resetTrackCues() {
      dropCueEdits([track.id])
    },
    selectCue(index: number) {
      setCueIndex(index)
    },
    addCue(index: number) {
      setTrackCues(track.cues.map((cue, i) => (i === index ? { label: 'Repère', position: freeSpot(track.cues) } : cue)))
      setCueIndex(index)
    },
    renameCue(label: string) {
      editActiveCue((cue) => ({ ...cue, label }))
    },
    nudgeCue(beats: number) {
      const beat = 60 / track.bpm / track.duration
      editActiveCue((cue) => ({ ...cue, position: Math.min(0.999, Math.max(0, cue.position + beats * beat)) }))
    },
    deleteCue() {
      setTrackCues(track.cues.map((cue, i) => (i === activeCue ? null : cue)))
      setCueIndex(0)
    },

    save() {
      if (status === 'saving') return
      setProgress(0)
      setStatus('saving')
      setToast(false)
    },
    closeToast() {
      setToast(false)
    },
    reread() {
      setRereading(true)
    },
  }
}
