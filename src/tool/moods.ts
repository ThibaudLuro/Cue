import { MOODS, type Mood } from './model'
import type { EnergyCurve } from './audio'
import type { Rhythm } from './rhythm'

// LAION's CLAP trained on music (Apache 2.0), converted for the browser.
export const CLAP_MODEL = 'Xenova/larger_clap_music_and_speech'

// How CLAP is told what each mood sounds like. It understands English descriptions; a few
// phrasings per mood smooth out the quirks of any single one. Edit freely: the embeddings
// are recomputed when this list changes.
export const MOOD_PROMPTS: Record<Mood, string[]> = {
  Nocturne: [
    'late night deep house music, smooth and intimate',
    'a mellow nocturnal electronic track for after hours',
    'warm, subdued deep house with soft basslines at night',
  ],
  Aérien: [
    'airy ethereal electronic music with floating pads',
    'dreamy atmospheric house music, spacious and weightless',
    'light ambient electronic track with soft reverb and open space',
  ],
  Mélodique: [
    'melodic house music with emotional synth melodies and chords',
    'melodic techno with uplifting arpeggios and a strong lead melody',
    'emotional progressive house with beautiful harmonies',
  ],
  Solaire: [
    'sunny summery afro house with warm percussion',
    'bright feel-good disco house music, joyful and groovy',
    'happy tropical dance music for a sunset party',
  ],
  Hypnotique: [
    'hypnotic minimal techno with a repetitive looping groove',
    'repetitive trance-inducing electronic rhythm, minimal and steady',
    'deep hypnotic tech house with rolling percussion',
  ],
  Sombre: [
    'dark ominous techno with heavy bass and industrial sounds',
    'gloomy menacing electronic music with a dark atmosphere',
    'dark warehouse techno, cold and mechanical',
  ],
  Énergique: [
    'high energy peak time techno, driving and intense',
    'powerful energetic club track with big drops',
    'fast hard-hitting dance music for a packed dancefloor',
  ],
}

export const PROMPTS_KEY = `${CLAP_MODEL}|${JSON.stringify(MOOD_PROMPTS)}`

// What the analysis keeps for one file. The mood itself is derived on the fly, so that the
// DJ's corrections reshape it without re-analysing anything.
export type Analysis = {
  // Missing when the mood model could not be loaded.
  embedding?: number[]
  // dBFS, see audio.ts.
  loudness: number
  duration: number
  // Missing in analyses saved before tempo detection (or the beat grid) existed.
  rhythm?: Rhythm
  // Missing in analyses saved before section detection existed.
  curve?: EnergyCurve
}

export type MoodVectors = Record<Mood, number[]>
export type MoodGuess = { mood: Mood | null; confidence: string; energy: number }

// Sharpness of the softmax over cosine similarities. CLAP's similarities are small and close
// together; this spreads them into usable probabilities. To tune on real tracks.
const SHARPNESS = 50
// Margin between the first and second mood below which Cue asks the DJ.
const UNSURE = 0.08
const SURE = 0.25
// Up to this share of the decision comes from the DJ's own corrections.
const MAX_PERSONAL = 0.6
const EXAMPLES_FOR_MAX = 30

function normalize(vector: number[]) {
  const norm = Math.hypot(...vector) || 1
  return vector.map((v) => v / norm)
}

function dot(a: number[], b: number[]) {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i]
  return sum
}

function mean(vectors: number[][]) {
  return normalize(vectors[0].map((_, i) => vectors.reduce((sum, v) => sum + v[i], 0) / vectors.length))
}

function softmax(scores: number[]) {
  const top = Math.max(...scores)
  const exps = scores.map((s) => Math.exp(SHARPNESS * (s - top)))
  const total = exps.reduce((a, b) => a + b, 0)
  return exps.map((e) => e / total)
}

// One vector per mood: the mean of its descriptions. textEmbeddings follows MOOD_PROMPTS' order.
export function moodVectors(textEmbeddings: number[][]): MoodVectors {
  let at = 0
  return Object.fromEntries(
    MOODS.map((mood) => {
      const count = MOOD_PROMPTS[mood].length
      const vectors = textEmbeddings.slice(at, at + count).map(normalize)
      at += count
      return [mood, mean(vectors)]
    }),
  ) as MoodVectors
}

export function promptList() {
  return MOODS.flatMap((mood) => MOOD_PROMPTS[mood])
}

// The 3 excerpts of a track become one embedding.
export function trackEmbedding(clipEmbeddings: number[][]) {
  return mean(clipEmbeddings.map(normalize))
}

// examples: embeddings of the tracks whose mood the DJ set by hand.
export function guessMood(
  embedding: number[],
  loudness: number,
  vectors: MoodVectors,
  examples: Record<Mood, number[][]>,
): MoodGuess {
  const described = softmax(MOODS.map((mood) => dot(embedding, vectors[mood])))

  // The DJ's corrections: closeness to the average of each mood's examples.
  const known = MOODS.filter((mood) => examples[mood].length > 0)
  const exampleCount = known.reduce((sum, mood) => sum + examples[mood].length, 0)
  let probabilities = described
  if (known.length > 0) {
    const personal = softmax(known.map((mood) => dot(embedding, mean(examples[mood]))))
    const weight = Math.min(MAX_PERSONAL, (exampleCount / EXAMPLES_FOR_MAX) * MAX_PERSONAL)
    probabilities = MOODS.map((mood, i) => {
      const k = known.indexOf(mood)
      return (1 - weight) * described[i] + weight * (k >= 0 ? personal[k] : 0)
    })
  }

  const ranked = probabilities.map((p, i) => ({ p, mood: MOODS[i] })).sort((a, b) => b.p - a.p)
  const margin = ranked[0].p - ranked[1].p
  const energetic = described[MOODS.indexOf('Énergique')]

  return {
    mood: margin < UNSURE ? null : ranked[0].mood,
    confidence: margin < UNSURE ? 'faible, à confirmer' : margin < SURE ? 'moyenne' : 'élevée',
    energy: energyLevel(loudness, energetic),
  }
}

// 1 to 5, mostly from how loud the track is (-20 dBFS → 0, -8 dBFS → 1), nudged by how
// "energetic" CLAP finds it.
function energyLevel(loudness: number, energetic: number) {
  const level = Math.min(1, Math.max(0, (loudness + 20) / 12))
  const value = 0.7 * level + 0.3 * Math.min(1, energetic * 3)
  return 1 + Math.round(4 * value)
}
