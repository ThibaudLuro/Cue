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
  type KeyFile,
} from './usbKey'

// unsupported: the browser has no File System Access API.
// checking: looking for the key picked last time.
// idle: no key yet. reconnect: a key is known but the browser wants the DJ's go-ahead again.
// ready: the key is plugged and read. unplugged: the key was read, then disappeared.
export type KeyPhase = 'unsupported' | 'checking' | 'idle' | 'reconnect' | 'ready' | 'unplugged'
export type UsbKey = ReturnType<typeof useUsbKey>

const POLL_MS = 1500

export function useUsbKey() {
  const [phase, setPhase] = useState<KeyPhase>(() => (isSupported() ? 'checking' : 'unsupported'))
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null)
  // null until the key has been read once.
  const [files, setFiles] = useState<KeyFile[] | null>(null)
  const [durations, setDurations] = useState<Record<string, number>>({})
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // By key name, as typed by the DJ.
  const [locations, setLocations] = useState<Record<string, string>>({})
  const scanId = useRef(0)
  const wasRead = useRef(false)
  const measured = useRef(new Set<string>())

  const read = useCallback(async (root: FileSystemDirectoryHandle) => {
    const id = ++scanId.current
    setScanning(true)
    setError(null)
    try {
      const found = await scanKey(root)
      if (id !== scanId.current) return
      wasRead.current = true
      setFiles(found)
      setPhase('ready')
    } catch {
      if (id !== scanId.current) return
      setPhase(wasRead.current ? 'unplugged' : 'idle')
      setError('Impossible de lire la clé. Vérifiez qu’elle est bien branchée.')
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
    loadLastKey().then(async (last) => {
      if (cancelled) return
      if (!last) return setPhase('idle')
      setHandle(last)
      if (!(await hasPermission(last))) return setPhase('reconnect')
      if (await isPlugged(last)) read(last)
      else setPhase('unplugged')
    })
    return () => {
      cancelled = true
    }
  }, [phase, read])

  // Unplugged and plugged back: the handle keeps pointing at the same drive.
  useEffect(() => {
    if (!handle || (phase !== 'ready' && phase !== 'unplugged')) return
    const timer = setInterval(async () => {
      if (scanning) return
      const plugged = await isPlugged(handle)
      if (phase === 'ready' && !plugged) setPhase('unplugged')
      if (phase === 'unplugged' && plugged) read(handle)
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [handle, phase, scanning, read])

  // Durations come in one by one after the scan, the list shows up right away.
  useEffect(() => {
    if (!files) return
    let cancelled = false
    ;(async () => {
      for (const file of files) {
        if (cancelled) return
        if (measured.current.has(file.path)) continue
        const seconds = await readDuration(file.handle).catch(() => 0)
        if (cancelled) return
        measured.current.add(file.path)
        setDurations((known) => ({ ...known, [file.path]: seconds }))
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
      setError('Le navigateur a refusé l’accès à ce dossier. Choisissez la racine de votre clé USB.')
    }
  }

  async function reconnect() {
    if (!handle) return connect()
    if (await requestPermission(handle)) read(handle)
    else setError('Accès refusé. Autorisez Cue à lire la clé pour continuer.')
  }

  const name = handle ? keyName(handle) : ''

  return {
    phase,
    root: handle,
    name,
    files,
    durations,
    scanning,
    error,
    // Where the key is on this computer, for rekordbox: worked out from the key itself when
    // possible (always better than a choice saved for an earlier plug-in), else the DJ's pick.
    location: guessLocation(name) || locations[name] || '',
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
      if (!handle) throw new Error('Aucune clé')
      let folder = handle
      for (const segment of path.slice(0, -1)) folder = await folder.getDirectoryHandle(segment, { create: true })
      const file = await folder.getFileHandle(path[path.length - 1], { create: true })
      const stream = await file.createWritable()
      await stream.write(content)
      await stream.close()
    },
  }
}

// Chrome names a drive root after its letter ("E:\"): keep it readable.
function keyName(handle: FileSystemDirectoryHandle) {
  return handle.name.replace(/[\\/]+$/, '') || 'Clé USB'
}

// A drive letter is the location on Windows; macOS mounts keys under /Volumes by name.
// Otherwise the DJ has to say.
function guessLocation(name: string) {
  if (/^[A-Za-z]:$/.test(name)) return `${name}/`
  if (/Mac/.test(navigator.userAgent)) return `/Volumes/${name}/`
  return ''
}
