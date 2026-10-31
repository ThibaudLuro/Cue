// Reads tracks from the key: excerpts for the mood model and the tempo/key detection,
// the waveform drawn on screen, AIFF made playable.

// CLAP listens at 48 kHz, 10 seconds at a time.
export const CLAP_RATE = 48000
const CLIP_SECONDS = 10
// Away from the intro and the outro, where every track sounds alike.
const CLIP_AT = [0.3, 0.5, 0.7]
// Tempo and key need a longer stretch, not the full band: the middle 2 minutes at 12 kHz.
export const RHYTHM_RATE = 12000
const RHYTHM_SECONDS = 120

export type Excerpts = {
  duration: number
  clips: Float32Array[]
  // Mean level of the excerpts in dBFS: club masters sit around -14 to -7.
  loudness: number
  // For rhythm.ts, at RHYTHM_RATE.
  signal: Float32Array
  // Where signal starts in the track, in seconds.
  signalOffset: number
  curve: EnergyCurve
}

type Mono = { samples: Float32Array; rate: number }

export async function readExcerpts(handle: FileSystemFileHandle): Promise<Excerpts> {
  const file = await handle.getFile()
  const { samples, rate } = await decode(await file.arrayBuffer(), file.name)
  const clipLength = Math.min(samples.length, CLIP_SECONDS * rate)

  const clips: Float32Array[] = []
  for (const at of CLIP_AT) {
    const start = Math.max(0, Math.min(samples.length - clipLength, Math.round(at * samples.length - clipLength / 2)))
    const clip = samples.slice(start, start + clipLength)
    clips.push(rate === CLAP_RATE ? clip : await resample(clip, rate, CLAP_RATE))
  }
  const signalLength = Math.min(samples.length, RHYTHM_SECONDS * rate)
  const signalStart = Math.round((samples.length - signalLength) / 2)
  const signal = await resample(samples.subarray(signalStart, signalStart + signalLength), rate, RHYTHM_RATE)

  return {
    duration: samples.length / rate,
    clips,
    loudness: loudness(clips),
    signal,
    signalOffset: signalStart / rate,
    curve: energyCurve(samples, rate),
  }
}

async function decode(bytes: ArrayBuffer, name: string, rate = CLAP_RATE): Promise<Mono> {
  // Chrome decodes MP3, WAV and FLAC itself, straight at the context's rate; not AIFF.
  if (isAiff(name)) {
    const { channels, rate } = decodeAiff(bytes)
    return { samples: mixDown(channels, channels[0].length), rate }
  }
  const buffer = await new OfflineAudioContext(1, 1, rate).decodeAudioData(bytes)
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c))
  return { samples: mixDown(channels, buffer.length), rate: buffer.sampleRate }
}

// ---- Waveform

// Drawn 160 bars wide; kept 3 times finer for a later zoom.
export const WAVE_POINTS = 480
// Enough to follow the level, cheap to decode.
const WAVE_RATE = 8000

// Per point, 0 to 100: the loudest sample (bar height) and the mean level (bar colour).
export type Wave = { peaks: number[]; rms: number[] }

export async function readWave(handle: FileSystemFileHandle): Promise<Wave> {
  const file = await handle.getFile()
  const { samples } = await decode(await file.arrayBuffer(), file.name, WAVE_RATE)
  const peaks: number[] = []
  const rms: number[] = []
  const size = samples.length / WAVE_POINTS
  for (let p = 0; p < WAVE_POINTS; p++) {
    const start = Math.floor(p * size)
    const end = Math.max(start + 1, Math.floor((p + 1) * size))
    let peak = 0
    let sum = 0
    for (let i = start; i < end && i < samples.length; i++) {
      peak = Math.max(peak, Math.abs(samples[i]))
      sum += samples[i] * samples[i]
    }
    peaks.push(peak)
    rms.push(Math.sqrt(sum / (end - start)))
  }
  return { peaks: toPercent(peaks), rms: toPercent(rms) }
}

export function isAiff(name: string) {
  return /\.aiff?$/i.test(name)
}

// The browser's player cannot read AIFF either: rewritten as a 16-bit WAV it can.
export function aiffToWav(bytes: ArrayBuffer) {
  const { channels, rate } = decodeAiff(bytes)
  const frames = channels[0].length
  const dataSize = frames * channels.length * 2
  const view = new DataView(new ArrayBuffer(44 + dataSize))
  const text = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))

  text(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels.length, true)
  view.setUint32(24, Math.round(rate), true)
  view.setUint32(28, Math.round(rate) * channels.length * 2, true)
  view.setUint16(32, channels.length * 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, dataSize, true)
  for (let frame = 0, at = 44; frame < frames; frame++) {
    for (const channel of channels) {
      const sample = Math.max(-1, Math.min(1, channel[frame]))
      view.setInt16(at, sample < 0 ? sample * 32768 : sample * 32767, true)
      at += 2
    }
  }
  return new Blob([view.buffer], { type: 'audio/wav' })
}

function mixDown(channels: Float32Array[], length: number) {
  if (channels.length === 1) return channels[0]
  const mono = new Float32Array(length)
  for (const channel of channels) {
    for (let i = 0; i < length; i++) mono[i] += channel[i] / channels.length
  }
  return mono
}

async function resample(samples: Float32Array, rate: number, target: number) {
  const length = Math.ceil((samples.length * target) / rate)
  const context = new OfflineAudioContext(1, length, target)
  const buffer = context.createBuffer(1, samples.length, rate)
  buffer.copyToChannel(new Float32Array(samples), 0)
  const source = context.createBufferSource()
  source.buffer = buffer
  source.connect(context.destination)
  source.start()
  return (await context.startRendering()).getChannelData(0)
}

// Level over the whole track, CURVE_RATE points a second, 0 to 100: everything, and the bass
// alone (below ~150 Hz), which tells whether the kick is playing.
export const CURVE_RATE = 4
export type EnergyCurve = { full: number[]; bass: number[] }

function energyCurve(samples: Float32Array, rate: number): EnergyCurve {
  const step = Math.round(rate / CURVE_RATE)
  const smoothing = 1 - Math.exp((-2 * Math.PI * 150) / rate)
  const full: number[] = []
  const bass: number[] = []
  let low = 0
  for (let start = 0; start < samples.length; start += step) {
    let sumFull = 0
    let sumBass = 0
    const end = Math.min(samples.length, start + step)
    for (let i = start; i < end; i++) {
      low += smoothing * (samples[i] - low)
      sumFull += samples[i] * samples[i]
      sumBass += low * low
    }
    full.push(Math.sqrt(sumFull / (end - start)))
    bass.push(Math.sqrt(sumBass / (end - start)))
  }
  return { full: toPercent(full), bass: toPercent(bass) }
}

function loudness(clips: Float32Array[]) {
  let sum = 0
  let count = 0
  for (const clip of clips) {
    for (const sample of clip) sum += sample * sample
    count += clip.length
  }
  return count ? 10 * Math.log10(sum / count + 1e-12) : -100
}

// AIFF and AIFF-C (uncompressed or little-endian "sowt", 8 to 32 bits, or 32-bit float).
function decodeAiff(bytes: ArrayBuffer) {
  const view = new DataView(bytes)
  const text = (offset: number) => String.fromCharCode(...new Uint8Array(bytes, offset, 4))
  if (text(0) !== 'FORM' || !['AIFF', 'AIFC'].includes(text(8))) throw new Error('Fichier AIFF illisible')

  let channels = 0
  let frames = 0
  let bits = 0
  let rate = 0
  let compression = 'NONE'
  let data = -1

  for (let offset = 12; offset + 8 <= view.byteLength; ) {
    const id = text(offset)
    const size = view.getUint32(offset + 4)
    const body = offset + 8
    if (id === 'COMM') {
      channels = view.getInt16(body)
      frames = view.getUint32(body + 2)
      bits = view.getInt16(body + 6)
      rate = extendedFloat(view, body + 8)
      if (size >= 22) compression = text(body + 18)
    } else if (id === 'SSND') {
      data = body + 8 + view.getUint32(body)
    }
    offset = body + size + (size % 2)
  }
  if (!channels || !rate || data < 0) throw new Error('Fichier AIFF illisible')

  const little = compression === 'sowt'
  const float = compression.toLowerCase() === 'fl32'
  if (!little && !float && compression !== 'NONE') throw new Error(`Compression AIFF non prise en charge : ${compression}`)

  const width = float ? 4 : Math.ceil(bits / 8)
  frames = Math.min(frames, Math.floor((view.byteLength - data) / (width * channels)))
  const read = sampleReader(view, width, little, float)
  const decoded = Array.from({ length: channels }, () => new Float32Array(frames))
  for (let frame = 0, at = data; frame < frames; frame++) {
    for (let c = 0; c < channels; c++, at += width) decoded[c][frame] = read(at)
  }
  return { channels: decoded, rate }
}

function sampleReader(view: DataView, width: number, little: boolean, float: boolean) {
  if (float) return (at: number) => view.getFloat32(at, little)
  if (width === 1) return (at: number) => view.getInt8(at) / 128
  if (width === 2) return (at: number) => view.getInt16(at, little) / 32768
  if (width === 4) return (at: number) => view.getInt32(at, little) / 2147483648
  // 24 bits.
  return (at: number) => {
    const [a, b, c] = little
      ? [view.getUint8(at + 2), view.getUint8(at + 1), view.getUint8(at)]
      : [view.getUint8(at), view.getUint8(at + 1), view.getUint8(at + 2)]
    const value = (a << 16) | (b << 8) | c
    return (value & 0x800000 ? value - 0x1000000 : value) / 8388608
  }
}

// AIFF stores its sample rate as an 80-bit IEEE extended float.
function extendedFloat(view: DataView, at: number) {
  const exponent = view.getUint16(at) & 0x7fff
  const high = view.getUint32(at + 2)
  const low = view.getUint32(at + 6)
  return high * 2 ** (exponent - 16383 - 31) + low * 2 ** (exponent - 16383 - 63)
}

// Relative to the loudest value: 0 to 100, compact to store.
function toPercent(values: number[]) {
  const top = Math.max(...values) || 1
  return values.map((v) => Math.round((v / top) * 100))
}
