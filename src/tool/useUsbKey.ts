import { useCallback, useEffect, useRef, useState } from 'react'
import { idbGetAll, idbSet } from '../lib/idb'
import {
  hasPermission,
  isPlugged,
  isSupported,
  loadLastKey,
  pickKey,
  readDuration,
  requestPermission,
  saveLastKey,
  scanKey,
  fileKey,
  within,
  type KeyFile,
} from './usbKey'

// unsupported: the browser has no File System Access API.
// checking: looking for the key picked last time.
// idle: no key yet. reconnect: a key is known but the browser wants the DJ's go-ahead again.
// ready: the key is plugged and read. unplugged: the key was read, then disappeared.
export type KeyPhase = 'unsupported' | 'checking' | 'idle' | 'reconnect' | 'ready' | 'unplugged'
export type UsbKey = ReturnType<typeof useUsbKey>

const POLL_MS = 1500
// How long the browser gets to show its permission prompt before Cue assumes it never will.
const RECONNECT_MS = 4000

export function useUsbKey() {
  const [phase, setPhase] = useState<KeyPhase>(() => (isSupported() ? 'checking' : 'unsupported'))
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null)
  // null until the key has been read once.
  const [files, setFiles] = useState<KeyFile[] | null>(null)
  const [durations, setDurations] = useState<Record<string, number>>({})
  const [scanning, setScanning] = useState(false)
  // Tracks found by the scan in progress.
  const [scanned, setScanned] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // By key name, as typed by the DJ.
  const [locations, setLocations] = useState<Record<string, string>>({})
  const scanId = useRef(0)
  const wasRead = useRef(false)
  const measured = useRef(new Set<string>())

  const read = useCallback(async (root: FileSystemDirectoryHandle) => {
    // Asks the browser not to clear what Cue keeps (analyses, waveforms, cues) when space runs low.
    navigator.storage?.persist?.().catch(() => {})
    const id = ++scanId.current
    setScanning(true)
    setScanned(0)
    setError(null)
    try {
      const found = await scanKey(root, (count) => {
        if (id === scanId.current) setScanned(count)
      })
      if (id !== scanId.current) return
      wasRead.current = true
      setFiles(found)
      setPhase('ready')
    } catch {
      if (id !== scanId.current) return
      setPhase(wasRead.current ? 'unplugged' : 'idle')
      setError('Can’t read the stick. Check that it is plugged in.')
    } finally {
      if (id === scanId.current) setScanning(false)
    }
  }, [])

  useEffect(() => {
    idbGetAll<unknown>('keys').then((stored) => {
      const typed = Object.entries(stored).filter(([id]) => id.startsWith('location:'))
      setLocations(Object.fromEntries(typed.map(([id, value]) => [id.slice('location:'.length), String(value)])))
    })
  }, [])

  // Back on the page: reuse the key picked last time if the browser still allows it.
  useEffect(() => {
    if (phase !== 'checking') return
    let cancelled = false
    ;(async () => {
      const last = await within(loadLastKey(), 5_000).catch(() => undefined)
      if (cancelled) return
      if (!last) return setPhase('idle')
      setHandle(last)
      // A stale handle can throw here: asking the DJ again is always a safe way out.
      // null: the browser did not answer. Seen with a drive root whose drive moved (another letter):
      // asking again would not answer either, so the DJ goes straight to picking the stick.
      const allowed = await within(hasPermission(last), 5_000).catch(() => null)
      if (cancelled) return
      if (allowed === null) {
        setPhase('idle')
        setError(`Cue can’t find ${keyName(last)} where it was last time. Choose your stick again.`)
        return
      }
      if (!allowed) return setPhase('reconnect')
      const plugged = await isPlugged(last)
      if (cancelled) return
      if (plugged) read(last)
      else setPhase('unplugged')
    })()
    return () => {
      cancelled = true
    }
  }, [phase, read])

  // Unplugged and plugged back: the handle keeps pointing at the same drive.
  // A check can take longer than POLL_MS (a busy drive answers slowly): one at a time, and the
  // answer of a check started under an older phase is dropped, or it would flip the phase back
  // and start a new read, over and over.
  useEffect(() => {
    if (!handle || scanning || (phase !== 'ready' && phase !== 'unplugged')) return
    let alive = true
    let checking = false
    let misses = 0
    const timer = setInterval(async () => {
      if (checking) return
      checking = true
      const plugged = await isPlugged(handle)
      checking = false
      if (!alive) return
      // A drive busy with the analysis can miss one check: gone only after two in a row.
      misses = plugged ? 0 : misses + 1
      if (phase === 'ready' && misses >= 2) {
        setPhase('unplugged')
      }
      if (phase === 'unplugged' && plugged) {
        read(handle)
      }
    }, POLL_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [handle, phase, scanning, read])

  // Durations come in one by one after the scan, the list shows up right away.
  useEffect(() => {
    if (!files) return
    let cancelled = false
    ;(async () => {
      // Read once per file content, then kept: an already seen key does not get re-measured.
      const saved = await idbGetAll<number>('durations')
      if (cancelled) return
      const known: Record<string, number> = {}
      for (const file of files) {
        const seconds = saved[fileKey(file)]
        if (seconds === undefined) continue
        known[file.path] = seconds
        measured.current.add(file.path)
      }
      setDurations((current) => ({ ...current, ...known }))

      for (const file of files) {
        if (cancelled) return
        if (measured.current.has(file.path)) continue
        const seconds = await readDuration(file.handle).catch(() => 0)
        if (cancelled) return
        measured.current.add(file.path)
        idbSet('durations', fileKey(file), seconds)
        setDurations((current) => ({ ...current, [file.path]: seconds }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [files])

  async function connect() {
    try {
      const picked = await pickKey()
      setHandle(picked)
      setFiles(null)
      setDurations({})
      wasRead.current = false
      measured.current.clear()
      await saveLastKey(picked)
      await read(picked)
    } catch (reason) {
      // The DJ closed the picker: nothing to report.
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      setError('The browser refused access to this folder. Choose the root of your USB stick.')
    }
  }

  // The remembered stick can point at a place that no longer exists (plugged under another drive
  // letter, renamed, reformatted): the browser then never shows its prompt and never answers.
  // After a while Cue offers to pick the stick again; a late "allow" still reads it.
  async function reconnect() {
    if (!handle) return connect()
    const asked = handle
    let answered = false
    const noAnswer = setTimeout(() => {
      if (answered) return
      setPhase('idle')
      setError(`Cue can’t find ${keyName(asked)} where it was last time. Choose your stick again.`)
    }, RECONNECT_MS)
    const allowed = await requestPermission(asked).catch(() => false)
    answered = true
    clearTimeout(noAnswer)
    if (allowed) read(asked)
    else {
      setPhase('idle')
      setError('Cue could not open this stick. Choose it again.')
    }
  }

  const name = handle ? keyName(handle) : ''

  return {
    phase,
    root: handle,
    name,
    files,
    durations,
    scanning,
    scanned,
    error,
    // Where the key is on this computer, for rekordbox: worked out from the key itself when
    // possible (always better than a choice saved for an earlier plug-in), else the DJ's pick.
    location: guessLocation(handle?.name ?? '') || locations[name] || '',
    setLocation(value: string) {
      setLocations((all) => ({ ...all, [name]: value }))
      idbSet('keys', `location:${name}`, value)
    },
    connect,
    reconnect,
    rescan() {
      if (handle && !scanning) read(handle)
    },
    // path: folders then file name, from the root of the key. Folders are created as needed.
    async write(path: string[], content: string) {
      if (!handle) throw new Error('No stick')
      let folder = handle
      for (const segment of path.slice(0, -1)) folder = await folder.getDirectoryHandle(segment, { create: true })
      const file = await folder.getFileHandle(path[path.length - 1], { create: true })
      const stream = await file.createWritable()
      await stream.write(content)
      await stream.close()
    },
  }
}


// Chrome may name a drive root after its letter ("E:\"): keep it readable.
function keyName(handle: FileSystemDirectoryHandle) {
  return handle.name.replace(/[\\/]+$/, '') || 'USB stick'
}

// The location, when the key's own name gives it away. On Windows the browser may call a drive
// root "E:\" or, like the Explorer, "CUE_USB (E:)": either way the letter is in it. macOS
// mounts keys under /Volumes by name. Otherwise it cannot be known from the page.
function guessLocation(rawName: string) {
  const letter = /(?:^|\()([A-Za-z]):[\\/]?\)?$/.exec(rawName.trim())?.[1]
  if (letter) return `${letter.toUpperCase()}:/`
  if (/Mac/.test(navigator.userAgent) && rawName) return `/Volumes/${rawName}/`
  return ''
}
