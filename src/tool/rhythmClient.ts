// Page side of the tempo/key worker.
import type { Rhythm } from './rhythm'
import type { RhythmRequest, RhythmResponse } from './rhythm.worker'

let worker: Worker | null = null
let nextId = 0
const pending = new Map<number, { resolve: (rhythm: Rhythm) => void; reject: (error: Error) => void }>()

function getWorker() {
  if (worker) return worker
  worker = new Worker(new URL('./rhythm.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = ({ data }: MessageEvent<RhythmResponse>) => {
    const request = pending.get(data.id)
    pending.delete(data.id)
    if ('rhythm' in data) request?.resolve(data.rhythm)
    else request?.reject(new Error(data.error))
  }
  return worker
}

// offset: where the signal starts in the track, in seconds.
export function detectRhythmOffThread(signal: Float32Array, rate: number, offset: number) {
  const id = nextId++
  return new Promise<Rhythm>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    // The signal is moved to the worker, not copied.
    getWorker().postMessage({ id, signal, rate, offset } satisfies RhythmRequest, [signal.buffer])
  })
}
