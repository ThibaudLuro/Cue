// Tempo and key detection on a mono signal, written for club music: steady tempo, clear kick.
// Pure functions, run in rhythm.worker.ts.

// beat: time of one beat in the track, in seconds; with the bpm it gives the whole grid.
export type Rhythm = { bpm: number | null; key: string | null; beat?: number | null }

// In-place radix-2 FFT; re and im have a power-of-two length.
function fft(re: Float32Array, im: Float32Array) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const step = (-2 * Math.PI) / size
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < size / 2; k++) {
        const cos = Math.cos(step * k)
        const sin = Math.sin(step * k)
        const a = start + k
        const b = a + size / 2
        const tr = re[b] * cos - im[b] * sin
        const ti = re[b] * sin + im[b] * cos
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
      }
    }
  }
}

// Magnitude spectrum of each frame, Hann-windowed.
function* spectra(signal: Float32Array, size: number, hop: number) {
  const window = Float32Array.from({ length: size }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size))
  const re = new Float32Array(size)
  const im = new Float32Array(size)
  const magnitude = new Float32Array(size / 2)
  for (let start = 0; start + size <= signal.length; start += hop) {
    for (let i = 0; i < size; i++) re[i] = signal[start + i] * window[i]
    im.fill(0)
    fft(re, im)
    for (let i = 0; i < size / 2; i++) magnitude[i] = Math.hypot(re[i], im[i])
    yield magnitude
  }
}

// ---- Tempo

const ONSET_SIZE = 512
const ONSET_HOP = 64
// Samples between the start of a frame and the attack its flux peak reports (see beatPhase).
const ONSET_LATENCY = 421
// Same window as rekordbox's default: settles "87 or 174?" the way DJs label tracks.
const MIN_BPM = 88
const MAX_BPM = 180
// Most club music sits around here: settles "half or double?" doubts.
const PREFERRED_BPM = 130
const PREFERENCE_WIDTH = 0.7 // octaves

// How much the sound "attacks" over time: positive changes of the log spectrum (spectral flux).
function onsetEnvelope(signal: Float32Array) {
  const envelope: number[] = []
  let previous: Float32Array | null = null
  for (const magnitude of spectra(signal, ONSET_SIZE, ONSET_HOP)) {
    const log = magnitude.map((m) => Math.log1p(100 * m))
    let flux = 0
    if (previous) for (let i = 0; i < log.length; i++) flux += Math.max(0, log[i] - previous[i])
    envelope.push(flux)
    previous = log
  }
  const mean = envelope.reduce((a, b) => a + b, 0) / (envelope.length || 1)
  return Float32Array.from(envelope, (v) => v - mean)
}

function autocorrelation(envelope: Float32Array, maxLag: number) {
  const result = new Float32Array(maxLag + 1)
  for (let lag = 0; lag <= maxLag; lag++) {
    let sum = 0
    for (let i = lag; i < envelope.length; i++) sum += envelope[i] * envelope[i - lag]
    result[lag] = sum / (envelope.length - lag)
  }
  return result
}

// A beat period shows up at every multiple of itself: summing them sharpens the peak and,
// with fractional lags, gives sub-frame precision.
function periodScore(ac: Float32Array, lag: number) {
  let score = 0
  for (let k = 1; k <= 8; k++) {
    const at = lag * k
    const i = Math.floor(at)
    if (i + 1 >= ac.length) break
    score += (ac[i] + (ac[i + 1] - ac[i]) * (at - i)) / k
  }
  return score
}

// Club music is in 4/4: halfway between two beats sit the offbeats (hats, claps), so a real
// beat period also resonates at 0.5, 1.5, 2.5… periods. A false "2/3 tempo" built from the
// eighth-note grid lands those points between the notes and loses.
function offbeatScore(ac: Float32Array, lag: number) {
  let score = 0
  for (let k = 1; k <= 8; k++) {
    const at = lag * (k - 0.5)
    const i = Math.floor(at)
    if (i + 1 >= ac.length) break
    score += (ac[i] + (ac[i + 1] - ac[i]) * (at - i)) / k
  }
  return score
}

export function detectBpm(signal: Float32Array, rate: number) {
  return tempo(onsetEnvelope(signal), rate / ONSET_HOP)
}

function tempo(envelope: Float32Array, frameRate: number) {
  const maxPeriod = (60 * frameRate) / MIN_BPM
  if (envelope.length < maxPeriod * 9) return null
  const ac = autocorrelation(envelope, Math.ceil(maxPeriod * 8) + 1)
  if (ac[0] <= 0) return null

  const minLag = Math.floor((60 * frameRate) / MAX_BPM)
  let best = { lag: 0, score: -Infinity }
  for (let lag = minLag; lag <= Math.ceil(maxPeriod); lag++) {
    const bpm = (60 * frameRate) / lag
    const preference = Math.exp(-0.5 * (Math.log2(bpm / PREFERRED_BPM) / PREFERENCE_WIDTH) ** 2)
    const score = (periodScore(ac, lag) + offbeatScore(ac, lag)) * preference
    if (score > best.score) best = { lag, score }
  }
  if (best.score <= 0) return null

  // Fine search around the best whole lag.
  let lag = best.lag
  let top = -Infinity
  for (let candidate = best.lag - 1; candidate <= best.lag + 1; candidate += 0.01) {
    const score = periodScore(ac, candidate)
    if (score > top) {
      top = score
      lag = candidate
    }
  }
  const bpm = (60 * frameRate) / lag
  // Produced music is almost always on a whole tempo.
  return Math.abs(bpm - Math.round(bpm)) < 0.25 ? Math.round(bpm) : Math.round(bpm * 10) / 10
}

// ---- Key

const CHROMA_SIZE = 8192
const CHROMA_HOP = 4096
const MIN_HZ = 55
const MAX_HZ = 2000

// Krumhansl-Kessler key profiles, from C.
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

// Energy of each of the 12 notes, all octaves together.
function chroma(signal: Float32Array, rate: number) {
  const bins = CHROMA_SIZE / 2
  const pitchClass = Int8Array.from({ length: bins }, (_, i) => {
    const hz = (i * rate) / CHROMA_SIZE
    if (hz < MIN_HZ || hz > MAX_HZ) return -1
    // C = 0.
    return (((Math.round(12 * Math.log2(hz / 440)) + 9) % 12) + 12) % 12
  })
  const total = new Float64Array(12)
  for (const magnitude of spectra(signal, CHROMA_SIZE, CHROMA_HOP)) {
    const frame = new Float64Array(12)
    for (let i = 0; i < bins; i++) if (pitchClass[i] >= 0) frame[pitchClass[i]] += magnitude[i] ** 2
    // Each frame counts the same, loud or quiet.
    const sum = frame.reduce((a, b) => a + b, 0)
    if (sum > 0) for (let p = 0; p < 12; p++) total[p] += Math.sqrt(frame[p] / sum)
  }
  return total
}

function correlation(a: ArrayLike<number>, b: number[]) {
  const n = b.length
  const meanA = Array.from(a).reduce((s, v) => s + v, 0) / n
  const meanB = b.reduce((s, v) => s + v, 0) / n
  let num = 0
  let da = 0
  let db = 0
  for (let i = 0; i < n; i++) {
    num += (a[i] - meanA) * (b[i] - meanB)
    da += (a[i] - meanA) ** 2
    db += (b[i] - meanB) ** 2
  }
  return da && db ? num / Math.sqrt(da * db) : 0
}

// Camelot wheel: neighbours mix well. C major = 8B, A minor = 8A.
export function camelot(tonic: number, minor: boolean) {
  const major = minor ? (tonic + 3) % 12 : tonic
  return `${((major * 7 + 7) % 12) + 1}${minor ? 'A' : 'B'}`
}

export function detectKey(signal: Float32Array, rate: number) {
  const notes = chroma(signal, rate)
  if (notes.every((v) => v === 0)) return null
  let best = { score: -Infinity, key: '' }
  for (let tonic = 0; tonic < 12; tonic++) {
    const rotate = (profile: number[]) => profile.map((_, i) => profile[(i - tonic + 12) % 12])
    for (const minor of [false, true]) {
      const score = correlation(notes, rotate(minor ? MINOR : MAJOR))
      if (score > best.score) best = { score, key: camelot(tonic, minor) }
    }
  }
  // Below this, no key stands out (drums only, noise).
  return best.score > 0.3 ? best.key : null
}

// Where the beats fall: the phase of the beat grid that lines up with the most attacks.
// Returns the time of one beat in seconds from the start of the signal.
function beatPhase(envelope: Float32Array, frameRate: number, bpm: number) {
  const period = (60 * frameRate) / bpm
  let best = { phase: 0, score: -Infinity }
  for (let phase = 0; phase < period; phase += 0.25) {
    let score = 0
    for (let at = phase; at + 1 < envelope.length; at += period) {
      const i = Math.floor(at)
      score += envelope[i] + (envelope[i + 1] - envelope[i]) * (at - i)
    }
    if (score > best.score) best = { phase, score }
  }
  // Where an attack sits in the frame that sees it jump, measured on synthetic kicks.
  return (best.phase * ONSET_HOP + ONSET_LATENCY) / (frameRate * ONSET_HOP)
}

// offset: where the signal starts in the track, in seconds, so the beat comes back in track time.
export function detectRhythm(signal: Float32Array, rate: number, offset = 0): Rhythm {
  const frameRate = rate / ONSET_HOP
  const envelope = onsetEnvelope(signal)
  const bpm = tempo(envelope, frameRate)
  const beat = bpm === null ? null : offset + beatPhase(envelope, frameRate, bpm)
  return { bpm, key: detectKey(signal, rate), beat }
}
