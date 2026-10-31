// Runs the CLAP model off the main thread: turns audio excerpts and mood descriptions into
// embeddings that can be compared. Everything stays on the DJ's computer; only the model
// itself is downloaded, once, then kept by the browser.
import {
  AutoProcessor,
  AutoTokenizer,
  ClapAudioModelWithProjection,
  ClapTextModelWithProjection,
  type ProgressInfo,
  type Tensor,
} from '@huggingface/transformers'
import { CLAP_MODEL } from './moods'

// Quantized: 78 MB to download instead of 280.
const OPTIONS = { dtype: 'q8', device: 'wasm' } as const

export type ClapJob = { type: 'text'; texts: string[] } | { type: 'audio'; clips: Float32Array[] }
export type ClapRequest = ClapJob & { id: number }

export type ClapResponse =
  | { id: number; type: 'result'; embeddings: number[][] }
  | { id: number; type: 'error'; message: string }
  | { type: 'download'; loaded: number; total: number }

const post = (message: ClapResponse) => self.postMessage(message)

// Download progress summed over every file of the model.
const files: Record<string, { loaded: number; total: number }> = {}
function onProgress(info: ProgressInfo) {
  if (info.status !== 'progress') return
  files[info.file] = { loaded: info.loaded, total: info.total }
  const all = Object.values(files)
  post({ type: 'download', loaded: all.reduce((s, f) => s + f.loaded, 0), total: all.reduce((s, f) => s + f.total, 0) })
}

let audio: Promise<[Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>, ClapAudioModelWithProjection]> | null = null
function audioModel() {
  audio ??= Promise.all([
    AutoProcessor.from_pretrained(CLAP_MODEL, { progress_callback: onProgress }),
    ClapAudioModelWithProjection.from_pretrained(CLAP_MODEL, { ...OPTIONS, progress_callback: onProgress }),
  ])
  return audio
}

function rows(tensor: Tensor) {
  const [count, size] = tensor.dims
  const data = tensor.data as Float32Array
  return Array.from({ length: count }, (_, i) => Array.from(data.subarray(i * size, (i + 1) * size)))
}

// The mood descriptions only need embedding once (the page caches them): the text model
// is loaded for that and released right after.
async function embedText(texts: string[]) {
  const [tokenizer, model] = await Promise.all([
    AutoTokenizer.from_pretrained(CLAP_MODEL, { progress_callback: onProgress }),
    ClapTextModelWithProjection.from_pretrained(CLAP_MODEL, { ...OPTIONS, progress_callback: onProgress }),
  ])
  try {
    const { text_embeds } = await model(tokenizer(texts, { padding: true, truncation: true }))
    return rows(text_embeds)
  } finally {
    await model.dispose()
  }
}

async function embedAudio(clips: Float32Array[]) {
  const [processor, model] = await audioModel()
  const embeddings: number[][] = []
  for (const clip of clips) {
    const { audio_embeds } = await model(await processor(clip))
    embeddings.push(...rows(audio_embeds))
  }
  return embeddings
}

self.onmessage = async ({ data: request }: MessageEvent<ClapRequest>) => {
  try {
    const embeddings = request.type === 'text' ? await embedText(request.texts) : await embedAudio(request.clips)
    post({ id: request.id, type: 'result', embeddings })
  } catch (error) {
    post({ id: request.id, type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
