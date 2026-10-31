// Tempo and key detection off the main thread: a couple of seconds of number crunching per track.
import { detectRhythm, type Rhythm } from './rhythm'

export type RhythmRequest = { id: number; signal: Float32Array; rate: number; offset: number }
export type RhythmResponse = { id: number; rhythm: Rhythm } | { id: number; error: string }

self.onmessage = ({ data }: MessageEvent<RhythmRequest>) => {
  try {
    self.postMessage({ id: data.id, rhythm: detectRhythm(data.signal, data.rate, data.offset) } satisfies RhythmResponse)
  } catch (error) {
    self.postMessage({ id: data.id, error: String(error) } satisfies RhythmResponse)
  }
}
