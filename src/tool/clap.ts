// Page side of the CLAP worker: one request at a time, answered by a promise.
import type { ClapJob, ClapRequest, ClapResponse } from './clap.worker'

type Pending = { resolve: (embeddings: number[][]) => void; reject: (error: Error) => void }
type Download = { loaded: number; total: number }

let worker: Worker | null = null
let nextId = 0
const pending = new Map<number, Pending>()
const listeners = new Set<(download: Download) => void>()

function getWorker() {
  if (worker) return worker
  worker = new Worker(new URL('./clap.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = ({ data }: MessageEvent<ClapResponse>) => {
    if (data.type === 'download') return listeners.forEach((listener) => listener(data))
    const request = pending.get(data.id)
    pending.delete(data.id)
    if (data.type === 'result') request?.resolve(data.embeddings)
    else request?.reject(new Error(data.message))
  }
  return worker
}

function send(job: ClapJob) {
  const id = nextId++
  return new Promise<number[][]>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    // The excerpts are moved to the worker, not copied.
    const transfer = job.type === 'audio' ? job.clips.map((clip) => clip.buffer) : []
    getWorker().postMessage({ ...job, id } satisfies ClapRequest, transfer)
  })
}

export function embedTexts(texts: string[]) {
  return send({ type: 'text', texts })
}

export function embedClips(clips: Float32Array[]) {
  return send({ type: 'audio', clips })
}

export function onModelDownload(listener: (download: Download) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
