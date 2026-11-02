import { useEffect, useMemo, useState } from 'react'
import { idbGet, idbGetAll, idbSet } from '../lib/idb'
import { readExcerpts, RHYTHM_RATE } from './audio'
import { embedClips, embedTexts, onModelDownload } from './clap'
import { MOODS, toMood, type Mood } from './model'
import {
  CLAP_MODEL,
  guessMood,
  moodVectors,
  promptList,
  PROMPTS_KEY,
  trackEmbedding,
  type Analysis,
  type MoodGuess,
  type MoodVectors,
} from './moods'
import { detectRhythmOffThread } from './rhythmClient'
import { detectSections, type Section } from './structure'
import { fileKey, type KeyFile } from './usbKey'

export type AnalysisState = 'pending' | 'running' | 'done' | 'failed'
export type TrackAnalysis = ReturnType<typeof useTrackAnalysis>

async function loadVectors() {
  const cached = await idbGet<number[][]>('embeddings', PROMPTS_KEY)
  const embeddings = cached ?? (await embedTexts(promptList()))
  if (!cached) await idbSet('embeddings', PROMPTS_KEY, embeddings)
  return moodVectors(embeddings)
}

// What a track still needs. Older analyses may lack the rhythm, the beat grid or the energy
// curve: the audio is then read again, without re-running the mood model.
// A file that failed is not retried until it changes on the key (or the mood model does).
function missing(analysis: Analysis | undefined, withMood: boolean) {
  if (analysis?.unreadable) return { mood: false, signal: false }
  const signal = !analysis?.rhythm || analysis.rhythm.beat === undefined || !analysis.curve
  const mood = withMood && !analysis?.embedding && analysis?.moodFailed !== CLAP_MODEL
  return { mood, signal }
}

function hasWork(analysis: Analysis | undefined) {
  const needs = missing(analysis, true)
  return needs.mood || needs.signal
}

// Analyses the key's tracks one by one in the background: mood (CLAP), tempo, key and parts.
// The DJ's mood corrections are remembered per file and teach the guesses for the other tracks.
export function useTrackAnalysis(files: KeyFile[]) {
  const [vectors, setVectors] = useState<MoodVectors | null>(null)
  // By file path.
  const [analyses, setAnalyses] = useState<Record<string, Analysis>>({})
  // Files whose saved analyses were looked up: until then, nothing is said to be missing.
  const [lookedUp, setLookedUp] = useState<KeyFile[] | null>(null)
  const [corrections, setCorrections] = useState<Record<string, Mood>>({})
  const [current, setCurrent] = useState<string | null>(null)
  const [download, setDownload] = useState<{ loaded: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => onModelDownload(setDownload), [])

  useEffect(() => {
    // Corrections saved under a former mood name count under the new one.
    idbGetAll<string>('corrections').then((stored) => {
      const read: Record<string, Mood> = {}
      for (const [path, name] of Object.entries(stored)) {
        const mood = toMood(name)
        if (mood) read[path] = mood
      }
      setCorrections(read)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const cached = await idbGetAll<Analysis>('analyses')
      const known: Record<string, Analysis> = {}
      for (const file of files) {
        const analysis = cached[fileKey(file)]
        if (analysis) known[file.path] = analysis
      }
      if (cancelled) return
      setAnalyses(known)
      setLookedUp(files)
      if (files.length === 0) return

      // Without the mood model (offline…), tempo and key still get detected.
      let withMood = true
      try {
        const loaded = await loadVectors()
        if (cancelled) return
        setVectors(loaded)
        setError(null)
      } catch {
        if (cancelled) return
        withMood = false
        setError('The energy model could not be loaded: check your internet connection. BPM and key are still detected.')
      }

      for (const file of files) {
        if (cancelled) return
        const previous = known[file.path]
        const needs = missing(previous, withMood)
        if (!needs.mood && !needs.signal) continue
        setCurrent(file.path)
        // Whatever happens, the outcome is saved: a file is never analysed twice for nothing.
        let analysis: Analysis
        try {
          const excerpts = await readExcerpts(file.handle)
          // Each part on its own: a mood model failure does not throw away tempo and key.
          const [clips, rhythm] = await Promise.all([
            needs.mood ? embedClips(excerpts.clips).catch(() => null) : null,
            needs.signal
              ? detectRhythmOffThread(excerpts.signal, RHYTHM_RATE, excerpts.signalOffset).catch(() => null)
              : null,
          ])
          analysis = {
            ...previous,
            loudness: excerpts.loudness,
            duration: excerpts.duration,
            ...(clips && { embedding: trackEmbedding(clips) }),
            ...(needs.mood && !clips && { moodFailed: CLAP_MODEL }),
            // No tempo found is an answer too: kept, so it is not searched again.
            ...(needs.signal && { rhythm: rhythm ?? { bpm: null, key: null, beat: null }, curve: excerpts.curve }),
          }
        } catch {
          analysis = { ...previous, loudness: previous?.loudness ?? -100, duration: previous?.duration ?? 0, unreadable: true }
        }
        await idbSet('analyses', fileKey(file), analysis)
        if (!cancelled) setAnalyses((all) => ({ ...all, [file.path]: analysis }))
      }
      if (!cancelled) setCurrent(null)
    })()
    return () => {
      cancelled = true
      setCurrent(null)
    }
  }, [files])

  const guesses = useMemo(() => {
    if (!vectors) return {}
    const examples = Object.fromEntries(MOODS.map((mood) => [mood, [] as number[][]])) as Record<Mood, number[][]>
    for (const [path, mood] of Object.entries(corrections)) {
      const embedding = analyses[path]?.embedding
      if (embedding) examples[mood].push(embedding)
    }
    const guessed: Record<string, MoodGuess> = {}
    for (const [path, analysis] of Object.entries(analyses)) {
      if (analysis.embedding) guessed[path] = guessMood(analysis.embedding, analysis.loudness, vectors, examples)
    }
    return guessed
  }, [vectors, analyses, corrections])

  // Parts and hot cue spots, recomputed only when an analysis lands.
  const sections = useMemo(() => {
    const found: Record<string, Section[]> = {}
    for (const [path, analysis] of Object.entries(analyses)) {
      if (!analysis.curve) continue
      const { bpm = null, beat = null } = analysis.rhythm ?? {}
      found[path] = detectSections(analysis.curve, analysis.duration, bpm, beat ?? null)
    }
    return found
  }, [analyses])

  function isDone(path: string) {
    const needs = missing(analyses[path], !error)
    return !needs.mood && !needs.signal && (Boolean(vectors) || Boolean(error))
  }

  function state(path: string): AnalysisState {
    if (isDone(path)) return 'done'
    if (analyses[path]?.unreadable) return 'failed'
    return path === current ? 'running' : 'pending'
  }

  const done = files.filter((file) => isDone(file.path) || analyses[file.path]?.unreadable).length

  return {
    analyses,
    guesses,
    sections,
    corrections,
    state,
    progress: {
      done,
      total: files.length,
      // Only when a track actually needs work: an analysed key opens without the banner.
      running: current !== null || (!vectors && !error && lookedUp === files && files.some((file) => hasWork(analyses[file.path]))),
      // Only while the model is actually being fetched.
      download: download && download.loaded < download.total ? download : null,
      // Path of the track being analysed right now.
      current,
      error,
    },
    correct(paths: string[], mood: Mood) {
      setCorrections((all) => ({ ...all, ...Object.fromEntries(paths.map((path) => [path, mood])) }))
      for (const path of paths) idbSet('corrections', path, mood)
    },
  }
}
