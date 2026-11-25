// Tempo and key detection on a mono signal, written for club music: steady tempo, clear kick.
// Pure functions, run in rhythm.worker.ts.

// beat: time of the first beat of the track, in seconds; with the bpm it gives the whole grid.
// downbeat: the first beat of a bar (the "1"). grid: GRID_VERSION it was found with; both are
// missing in older analyses.
export type Rhythm = {
  bpm: number | null
  key: string | null
  beat?: number | null
  downbeat?: number | null
  grid?: number
}

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

// A first estimate, unrounded: the grid fit (fitGrid) makes it exact.
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
  return (60 * frameRate) / lag
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

// ---- Beat grid
// rekordbox draws a grid line where the kick starts. Hats, claps and offbeat basslines attack
// too, halfway between the kicks: the grid is found on the kick's band alone, else it can land
// on the offbeats. Then every kick of the track is located to the millisecond and the grid is
// fitted on all of them: a tempo off by 0.05 BPM already drifts by a quarter of a beat over a
// 6-minute track.

// Bumped when the grid changes: older analyses are redone.
export const GRID_VERSION = 2

const KICK_LOW_HZ = 30
const KICK_HIGH_HZ = 150
const KICK_SIZE = 1024
// As ONSET_LATENCY, for KICK_SIZE frames. Only a first guess: fitGrid finds each attack.
const KICK_LATENCY = Math.round((ONSET_LATENCY * KICK_SIZE) / ONSET_SIZE)
// Tempo and key are read from the middle of the track, where the groove is.
const MIDDLE_SECONDS = 120

// Attacks of the kick: spectral flux of the low band.
function kickEnvelope(signal: Float32Array, rate: number) {
  const from = Math.ceil((KICK_LOW_HZ * KICK_SIZE) / rate)
  const to = Math.floor((KICK_HIGH_HZ * KICK_SIZE) / rate)
  const envelope: number[] = []
  let previous: Float32Array | null = null
  for (const magnitude of spectra(signal, KICK_SIZE, ONSET_HOP)) {
    const log = magnitude.slice(from, to + 1).map((m) => Math.log1p(100 * m))
    let flux = 0
    if (previous) for (let i = 0; i < log.length; i++) flux += Math.max(0, log[i] - previous[i])
    envelope.push(flux)
    previous = log
  }
  const mean = envelope.reduce((a, b) => a + b, 0) / (envelope.length || 1)
  return Float32Array.from(envelope, (v) => v - mean)
}

// Where the beats fall, roughly: the phase of the grid that lines up with the most kicks.
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
  return (best.phase * ONSET_HOP + KICK_LATENCY) / (frameRate * ONSET_HOP)
}

// Filters run forwards then backwards: no delay, so a rise stays where the sound has it.
function lowPass(signal: Float32Array, rate: number, hz: number) {
  const a = 1 - Math.exp((-2 * Math.PI * hz) / rate)
  const out = Float32Array.from(signal)
  for (let pass = 0; pass < 2; pass++) {
    let y = 0
    for (let i = 0; i < out.length; i++) out[i] = y += a * (out[i] - y)
    y = 0
    for (let i = out.length - 1; i >= 0; i--) out[i] = y += a * (out[i] - y)
  }
  return out
}

// How fast the kick's energy rises, sample by sample: highest where a kick starts.
function kickRise(signal: Float32Array, rate: number) {
  const low = lowPass(signal, rate, KICK_HIGH_HZ)
  for (let i = 0; i < low.length; i++) low[i] *= low[i]
  // Smooths the 50–100 Hz ripple of the squared kick, a few milliseconds.
  const energy = lowPass(low, rate, 60)
  const step = Math.round(rate / 1000)
  const rise = new Float32Array(energy.length)
  for (let i = step; i + step < energy.length; i++) rise[i] = energy[i + step] - energy[i - step]
  return rise
}

// The kick's low body can swell up to 70 ms after its click, the attack rekordbox draws the line
// on. Once the grid is fitted on the body, it is moved onto the click: where the treble rises the
// sharpest, on average over every beat.
const CLICK_HZ = 2000
// Usually before the body; on some masters the body leads by a few tens of milliseconds.
const CLICK_SEARCH = [-0.08, 0.04]
// Time between where a kick starts and where clickRise peaks, measured on synthetic kicks: the
// backward pass of the filters makes it peak a hair early.
const CLICK_LATENCY = -0.0009

function clickRise(signal: Float32Array, rate: number) {
  const low = lowPass(signal, rate, CLICK_HZ)
  const high = new Float32Array(signal.length)
  for (let i = 0; i < high.length; i++) high[i] = (signal[i] - low[i]) ** 2
  const energy = lowPass(high, rate, 150)
  const step = Math.round(rate / 1000)
  const rise = new Float32Array(energy.length)
  for (let i = step; i + step < energy.length; i++) rise[i] = energy[i + step] - energy[i - step]
  return rise
}

// How far the click sits from the grid, in seconds (negative: before it).
function clickShift(rise: Float32Array, rate: number, grid: Grid) {
  const [from, to] = CLICK_SEARCH.map((s) => Math.round(s * rate))
  let best = { shift: 0, score: -Infinity }
  for (let lag = from; lag <= to; lag++) {
    let score = 0
    for (let k = grid.first; k <= grid.last; k++) {
      const i = Math.round((grid.anchor + k * grid.period) * rate) + lag
      if (i >= 0 && i < rise.length) score += rise[i]
    }
    if (score > best.score) best = { shift: lag / rate, score }
  }
  return best.shift
}

type Grid = { period: number; anchor: number; first: number; last: number }

// One round of the fit: the stretch of the track looked at (seconds) and how far from the grid an
// attack is looked for.
type Pass = { from: number; to: number; reach: number }

// Fits a straight grid through the attacks: time of beat k = anchor + k × period, by weighted
// least squares, each attack weighing by how sharp it is. Passes go from the middle of the track
// outwards, so a first tempo a bit off still finds the next kicks.
function fitGrid(rise: Float32Array, rate: number, period: number, anchor: number, passes: Pass[]): Grid | null {
  let grid: Grid | null = null
  for (const pass of passes) {
    const [lo, hi] = [pass.from, pass.to]
    const reach = Math.round(pass.reach * rate)
    const kicks: { k: number; time: number; weight: number }[] = []
    for (let k = Math.ceil((lo - anchor) / period); anchor + k * period <= hi; k++) {
      const centre = Math.round((anchor + k * period) * rate)
      let top = 0
      let at = -1
      for (let i = Math.max(0, centre - reach); i <= Math.min(rise.length - 1, centre + reach); i++) {
        if (rise[i] > top) {
          top = rise[i]
          at = i
        }
      }
      if (at >= 0) kicks.push({ k, time: at / rate, weight: top })
    }
    // Weak "kicks" are where there is none (breaks): left out.
    const sorted = kicks.map((kick) => kick.weight).sort((a, b) => a - b)
    const strong = sorted[Math.floor(sorted.length * 0.75)] ?? 0
    let kept = kicks.filter((kick) => kick.weight >= strong * 0.3)
    for (let trim = 0; trim < 2 && kept.length >= 8; trim++) {
      const fitted = leastSquares(kept)
      period = fitted.period
      anchor = fitted.anchor
      // A hit that is not the kick (a fill, a snare roll): out of the next fit.
      kept = kept.filter((kick) => Math.abs(kick.time - (anchor + kick.k * period)) < 0.012)
    }
    if (kept.length < 8) return grid
    grid = { period, anchor, first: kept[0].k, last: kept[kept.length - 1].k }
  }
  return grid
}

function leastSquares(points: { k: number; time: number; weight: number }[]) {
  let w = 0
  let k = 0
  let t = 0
  for (const p of points) {
    w += p.weight
    k += p.weight * p.k
    t += p.weight * p.time
  }
  const meanK = k / w
  const meanT = t / w
  let kk = 0
  let kt = 0
  for (const p of points) {
    kk += p.weight * (p.k - meanK) ** 2
    kt += p.weight * (p.k - meanK) * (p.time - meanT)
  }
  const period = kk > 0 ? kt / kk : 0
  return { period, anchor: meanT - period * meanK }
}

// The tempo rekordbox will play the grid at: whole if that keeps every beat of the track within
// a few milliseconds of its kick (most produced music), else to the hundredth, as in its XML.
function roundTempo(grid: Grid) {
  const bpm = 60 / grid.period
  const halfSpan = (grid.last - grid.first) / 2
  const whole = Math.round(bpm)
  return Math.abs(60 / whole - grid.period) * halfSpan < 0.006 ? whole : Math.round(bpm * 100) / 100
}

// offset: where the signal starts in the track, in seconds, so the beat comes back in track time.
export function detectRhythm(signal: Float32Array, rate: number, offset = 0): Rhythm {
  const length = Math.min(signal.length, MIDDLE_SECONDS * rate)
  const start = Math.floor((signal.length - length) / 2)
  const middle = signal.subarray(start, start + length)
  const frameRate = rate / ONSET_HOP
  const key = detectKey(middle, rate)
  const rough = tempo(onsetEnvelope(middle), frameRate)
  if (rough === null) return { bpm: null, key, beat: null, grid: GRID_VERSION }

  const [from, to] = [start / rate, (start + length) / rate]
  const duration = signal.length / rate
  const phase = from + beatPhase(kickEnvelope(middle, rate), frameRate, rough)
  // On the kick's body first: it tells the beats from the offbeats. The stretch grows a little at
  // each pass: a tempo fitted on the middle only is just good enough to find the next kicks, not
  // those minutes away.
  const passes: Pass[] = [{ from, to, reach: 0.04 }]
  for (let half = (to - from) / 2; ; half *= 1.4) {
    const centre = (from + to) / 2
    passes.push({ from: Math.max(0, centre - half), to: Math.min(duration, centre + half), reach: 0.02 })
    if (centre - half <= 0 && centre + half >= duration) break
  }
  const body = fitGrid(kickRise(signal, rate), rate, 60 / rough, phase, passes)
  if (!body) {
    const bpm = Math.round(rough * 100) / 100
    return { bpm, key, beat: offset + phase, grid: GRID_VERSION }
  }
  // Then on the clicks, where rekordbox draws the lines: the body can swell later in one part
  // of the track than in another.
  const clicks = clickRise(signal, rate)
  const shifted = body.anchor + clickShift(clicks, rate, body)
  const grid =
    fitGrid(clicks, rate, body.period, shifted, [...passes.slice(1).map((pass) => ({ ...pass, reach: 0.008 }))]) ??
    { ...body, anchor: shifted }
  const bpm = roundTempo(grid)
  // The grid at that tempo, centred on the kicks it was fitted on.
  const period = 60 / bpm
  const middleK = (grid.first + grid.last) / 2
  const anchor = grid.anchor + middleK * (grid.period - period) - CLICK_LATENCY
  // The first beat of the track.
  const beat = anchor - Math.floor(anchor / period) * period
  const downbeat = findDownbeat(signal, rate, period, beat)
  return { bpm, key, beat: offset + beat, downbeat: offset + downbeat, grid: GRID_VERSION }
}

// ---- Bars

// Parts of a track change on the first beat of a bar: the bass comes in, the break starts.
// Each beat gets its level, and of the four ways to group beats into bars, the one whose bar
// starts see the sharpest changes wins.
const BAR_WINDOW = 4

function findDownbeat(signal: Float32Array, rate: number, period: number, beat: number) {
  const low = lowPass(signal, rate, KICK_HIGH_HZ)
  const bass: number[] = []
  const full: number[] = []
  for (let k = 0; beat + (k + 1) * period <= signal.length / rate; k++) {
    const from = Math.round((beat + k * period) * rate)
    const to = Math.round((beat + (k + 1) * period) * rate)
    let sumLow = 0
    let sumFull = 0
    for (let i = from; i < to; i++) {
      sumLow += low[i] * low[i]
      sumFull += signal[i] * signal[i]
    }
    bass.push(Math.log10(sumLow / (to - from) + 1e-9))
    full.push(Math.log10(sumFull / (to - from) + 1e-9))
  }
  const mean = (values: number[], from: number, to: number) => {
    let sum = 0
    for (let i = from; i < to; i++) sum += values[i]
    return sum / (to - from)
  }
  const change: number[][] = [[], [], [], []]
  for (let k = BAR_WINDOW; k + BAR_WINDOW <= bass.length; k++) {
    const before = k - BAR_WINDOW
    const after = k + BAR_WINDOW
    change[k % 4].push(
      Math.abs(mean(bass, k, after) - mean(bass, before, k)) + 0.5 * Math.abs(mean(full, k, after) - mean(full, before, k)),
    )
  }
  // The few biggest changes decide: everywhere else, the music just goes on.
  const strongest = (values: number[]) =>
    [...values]
      .sort((a, b) => b - a)
      .slice(0, 6)
      .reduce((a, b) => a + b, 0)
  let best = 0
  for (let r = 1; r < 4; r++) if (strongest(change[r]) > strongest(change[best])) best = r
  return beat + best * period
}
