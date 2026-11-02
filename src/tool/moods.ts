import { MOODS, type Mood } from './model'
import type { EnergyCurve } from './audio'
import type { Rhythm } from './rhythm'

// LAION's CLAP trained on music (Apache 2.0), converted for the browser.
export const CLAP_MODEL = 'Xenova/larger_clap_music_and_speech'

// How CLAP is told what each energy level sounds like. It understands English descriptions; a
// few phrasings per level smooth out the quirks of any single one. Edit freely: the embeddings
// are recomputed when this list changes.
export const MOOD_PROMPTS: Record<Mood, string[]> = {
  '1 · Low': [
    'calm ambient downtempo music, soft and slow',
    'relaxed chill-out electronic track with gentle beats',
    'quiet atmospheric music without a strong kick drum',
  ],
  '2 · Warm-up': [
    'laid-back deep house with a soft groove',
    'mellow warm-up house music, smooth and relaxed',
    'easy-going lounge house with soft percussion',
  ],
  '3 · Groove': [
    'groovy house music with a steady danceable beat',
    'funky tech house groove for the dancefloor',
    'rolling melodic house with a solid kick drum',
  ],
  '4 · Build': [
    'driving techno with a relentless pumping beat',
    'energetic progressive house building tension',
    'hypnotic driving rhythm with heavy bass',
  ],
  '5 · Peak': [
    'powerful peak time techno with huge drops',
    'hard-hitting fast dance music for a packed dancefloor',
    'intense rave track with aggressive energy',
  ],
}

// Only the descriptions matter (in MOODS order): renaming a mood does not re-embed them.
export const PROMPTS_KEY = `${CLAP_MODEL}|${JSON.stringify(MOODS.map((mood) => MOOD_PROMPTS[mood]))}`

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
  // The mood model failed on this file (with this model): not retried at every visit.
  moodFailed?: string
  // The file could not be decoded: not retried until it changes on the key.
  unreadable?: boolean
}

export type MoodVectors = Record<Mood, number[]>
export type MoodGuess = { mood: Mood | null; confidence: string; energy: number }

// Sharpness of the softmax over cosine similarities. CLAP's similarities are small and close
// together; this spreads them into usable probabilities. To tune on real tracks.
const SHARPNESS = 50
// Margin between the first and second level below which Cue asks the DJ.
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

// examples: embeddings of the tracks whose level the DJ set by hand.
export function guessMood(
  embedding: number[],
  loudness: number,
  vectors: MoodVectors,
  examples: Record<Mood, number[][]>,
): MoodGuess {
  const described = softmax(MOODS.map((mood) => dot(embedding, vectors[mood])))

  // The DJ's corrections: closeness to the average of each level's examples.
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

  // How loud the track is also says something about its energy: a nudge towards that level.
  const loud = loudnessLevel(loudness)
  probabilities = probabilities.map((p, i) => (1 - LOUDNESS_WEIGHT) * p + LOUDNESS_WEIGHT * closeness(i, loud))

  const ranked = probabilities.map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p)
  const margin = ranked[0].p - ranked[1].p
  // Next to each other (3 or 4?), a hesitation matters less than between far levels.
  const unsure = margin < UNSURE && Math.abs(ranked[0].i - ranked[1].i) > 1

  return {
    mood: unsure ? null : MOODS[ranked[0].i],
    confidence: unsure ? 'low, please confirm' : margin < SURE ? 'medium' : 'high',
    energy: ranked[0].i + 1,
  }
}

// Share of the decision given to loudness.
const LOUDNESS_WEIGHT = 0.25

// 0 to 4, from how loud the track is: -20 dBFS → 0, -8 dBFS → 4.
function loudnessLevel(loudness: number) {
  return 4 * Math.min(1, Math.max(0, (loudness + 20) / 12))
}

// 1 on the level itself, fading over the neighbours; sums to 1 over the levels.
function closeness(level: number, target: number) {
  const weights = MOODS.map((_, i) => Math.exp(-((i - target) ** 2)))
  const total = weights.reduce((a, b) => a + b, 0)
  return weights[level] / total
}
