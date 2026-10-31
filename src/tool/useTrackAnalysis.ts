import { useEffect, useMemo, useState } from 'react'
import { idbGet, idbGetAll, idbSet } from '../lib/idb'
import { readExcerpts, RHYTHM_RATE } from './audio'
import { embedClips, embedTexts, onModelDownload } from './clap'
import { MOODS, type Mood } from './model'
import {
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
function missing(analysis: Analysis | undefined, withMood: boolean) {
  const signal = !analysis?.rhythm || analysis.rhythm.beat === undefined || !analysis.curve
  return { mood: withMood && !analysis?.embedding, signal }
}

// Analyses the key's tracks one by one in the background: mood (CLAP), tempo, key and parts.
// The DJ's mood corrections are remembered per file and teach the guesses for the other tracks.
export function useTrackAnalysis(files: KeyFile[]) {
  const [vectors, setVectors] = useState<MoodVectors | null>(null)
  // By file path.
  const [analyses, setAnalyses] = useState<Record<string, Analysis>>({})
  const [corrections, setCorrections] = useState<Record<string, Mood>>({})
  const [failed, setFailed] = useState<string[]>([])
  const [current, setCurrent] = useState<string | null>(null)
  const [download, setDownload] = useState<{ loaded: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => onModelDownload(setDownload), [])

  useEffect(() => {
    idbGetAll<Mood>('corrections').then(setCorrections)
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
      setFailed([])
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
        setError('Le modèle d’ambiance n’a pas pu être chargé : vérifiez votre connexion internet. BPM et clé sont tout de même détectés.')
      }

      for (const file of files) {
        if (cancelled) return
        const previous = known[file.path]
        const needs = missing(previous, withMood)
        if (!needs.mood && !needs.signal) continue
        setCurrent(file.path)
        try {
          const excerpts = await readExcerpts(file.handle)
          const [clips, rhythm] = await Promise.all([
            needs.mood ? embedClips(excerpts.clips) : null,
            needs.signal ? detectRhythmOffThread(excerpts.signal, RHYTHM_RATE, excerpts.signalOffset) : null,
          ])
          const analysis: Analysis = {
            ...previous,
            loudness: excerpts.loudness,
            duration: excerpts.duration,
            ...(clips && { embedding: trackEmbedding(clips) }),
            ...(rhythm && { rhythm, curve: excerpts.curve }),
          }
          await idbSet('analyses', fileKey(file), analysis)
          if (!cancelled) setAnalyses((all) => ({ ...all, [file.path]: analysis }))
        } catch {
          if (!cancelled) setFailed((paths) => [...paths, file.path])
        }
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
    if (failed.includes(path)) return 'failed'
    return path === current ? 'running' : 'pending'
  }

  const done = files.filter((file) => isDone(file.path) || failed.includes(file.path)).length

  return {
    analyses,
    guesses,
    sections,
    corrections,
    state,
    progress: {
      done,
      total: files.length,
      running: current !== null || (!vectors && !error && files.length > 0),
      // Only while the model is actually being fetched.
      download: download && download.loaded < download.total ? download : null,
      error,
    },
    correct(paths: string[], mood: Mood) {
      setCorrections((all) => ({ ...all, ...Object.fromEntries(paths.map((path) => [path, mood])) }))
      for (const path of paths) idbSet('corrections', path, mood)
    },
  }
}
