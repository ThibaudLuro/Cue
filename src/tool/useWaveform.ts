import { useEffect, useState } from 'react'
import { idbGet, idbSet } from '../lib/idb'
import { readWave, type Wave } from './audio'
import { fileKey, type KeyFile } from './usbKey'

// Waveforms already drawn in this visit.
const memory = new Map<string, Wave>()

// The real waveform of the selected track, computed when it is first opened (about a second),
// then kept in the browser.
export function useWaveform(file: KeyFile | undefined) {
  const key = file ? fileKey(file) : ''
  // Bumped when a waveform lands in memory, to redraw.
  const [, setReady] = useState('')
  const [failed, setFailed] = useState<string[]>([])

  useEffect(() => {
    if (!file || memory.has(key)) return
    let cancelled = false
    ;(async () => {
      try {
        let wave = await idbGet<Wave>('waves', key)
        if (!wave) {
          wave = await readWave(file.handle)
          idbSet('waves', key, wave)
        }
        memory.set(key, wave)
        if (!cancelled) setReady(key)
      } catch {
        if (!cancelled) setFailed((keys) => [...keys, key])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [file, key])

  return { wave: memory.get(key) ?? null, failed: failed.includes(key) }
}
