import { idbGet, idbSet } from '../lib/idb'

// Access to the DJ's USB key through the File System Access API (Chrome, Edge, Opera).
// A web page cannot list the drives plugged into the computer: the DJ picks the key once,
// Cue keeps its handle and then notices on its own when the key is unplugged or plugged back.

// Not in TypeScript's DOM lib yet.
declare global {
  interface Window {
    showDirectoryPicker(options?: { id?: string; mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>
  }
  interface FileSystemHandle {
    queryPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>
    requestPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>
  }
  interface FileSystemDirectoryHandle {
    values(): AsyncIterableIterator<FileSystemFileHandle | FileSystemDirectoryHandle>
  }
}

export type KeyFile = {
  path: string
  name: string
  size: number
  lastModified: number
  handle: FileSystemFileHandle
}

const AUDIO = /\.(mp3|wav|flac|aiff?)$/i
// System folders and macOS "._" companions: never music.
const SKIPPED = /^(\.|System Volume Information$|\$RECYCLE\.BIN$)/i
const MODE = { mode: 'readwrite' } as const

export function isSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export function pickKey() {
  return window.showDirectoryPicker({ id: 'cue-key', mode: 'readwrite' })
}

export async function hasPermission(handle: FileSystemDirectoryHandle) {
  return (await handle.queryPermission(MODE)) === 'granted'
}

// Must be called from a click: the browser shows its own prompt.
export async function requestPermission(handle: FileSystemDirectoryHandle) {
  return (await handle.requestPermission(MODE)) === 'granted'
}

// A drive that stops answering (asleep, half unplugged) can leave a browser call waiting forever.
// The scan gives up once a single step has not come back for this long, however big the key is.
const STALL_MS = 20_000

// Rejects if `promise` takes longer than `ms`. The browser call keeps running, its result is dropped.
export function within<T>(promise: Promise<T>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('The stick is not answering')), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// onProgress: tracks found so far, so a big key shows it is moving.
export async function scanKey(root: FileSystemDirectoryHandle, onProgress?: (found: number) => void) {
  const files: KeyFile[] = []

  async function walk(dir: FileSystemDirectoryHandle, prefix: string) {
    const entries = dir.values()
    while (true) {
      const next = await within(entries.next(), STALL_MS)
      if (next.done) break
      const entry = next.value
      if (SKIPPED.test(entry.name)) continue
      const path = prefix + entry.name
      if (entry.kind === 'directory') {
        await walk(entry, `${path}/`)
      } else if (AUDIO.test(entry.name)) {
        const file = await within(entry.getFile(), STALL_MS)
        files.push({ path, name: entry.name, size: file.size, lastModified: file.lastModified, handle: entry })
        onProgress?.(files.length)
      }
    }
  }

  await walk(root, '')
  return files.sort((a, b) => a.path.localeCompare(b.path, 'en'))
}

// Reading the first entry fails once the drive is gone. A drive that does not answer counts as gone.
export async function isPlugged(root: FileSystemDirectoryHandle) {
  try {
    await within(root.values().next(), 5_000)
    return true
  } catch {
    return false
  }
}

// Duration from the file's metadata, without decoding the audio. 0 if the browser cannot read it.
export async function readDuration(handle: FileSystemFileHandle) {
  const url = URL.createObjectURL(await handle.getFile())
  try {
    return await new Promise<number>((resolve) => {
      const audio = new Audio()
      audio.preload = 'metadata'
      audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0)
      audio.onerror = () => resolve(0)
      audio.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

// The handle survives reloads, so the DJ only picks the key once.
const LAST_KEY = 'last'

export function loadLastKey() {
  return idbGet<FileSystemDirectoryHandle>('keys', LAST_KEY)
}

export function saveLastKey(handle: FileSystemDirectoryHandle) {
  return idbSet('keys', LAST_KEY, handle)
}

// Identifies a file's content: what is derived from it is recomputed only if it changed on the key.
export function fileKey(file: KeyFile) {
  return `${file.path}|${file.size}|${file.lastModified}`
}
