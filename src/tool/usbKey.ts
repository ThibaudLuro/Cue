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

export async function scanKey(root: FileSystemDirectoryHandle) {
  const files: KeyFile[] = []

  async function walk(dir: FileSystemDirectoryHandle, prefix: string) {
    for await (const entry of dir.values()) {
      if (SKIPPED.test(entry.name)) continue
      const path = prefix + entry.name
      if (entry.kind === 'directory') {
        await walk(entry, `${path}/`)
      } else if (AUDIO.test(entry.name)) {
        const file = await entry.getFile()
        files.push({ path, name: entry.name, size: file.size, lastModified: file.lastModified, handle: entry })
      }
    }
  }

  await walk(root, '')
  return files.sort((a, b) => a.path.localeCompare(b.path, 'fr'))
}

// Reading the first entry fails once the drive is gone.
export async function isPlugged(root: FileSystemDirectoryHandle) {
  try {
    for await (const entry of root.values()) {
      void entry
      break
    }
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
