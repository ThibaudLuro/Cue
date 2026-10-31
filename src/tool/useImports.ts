import { useEffect, useState } from 'react'
import { readImports, type Imported } from './imports'
import type { KeyFile } from './usbKey'

// What rekordbox (or an earlier Cue export) left on the key, read each time the key is read.
export function useImports(root: FileSystemDirectoryHandle | null, files: KeyFile[]) {
  const [imported, setImported] = useState<{ tracks: Record<string, Imported>; mount: string | null }>({
    tracks: {},
    mount: null,
  })

  useEffect(() => {
    if (!root || files.length === 0) return
    let cancelled = false
    readImports(root, files)
      .then((found) => {
        if (!cancelled) setImported(found)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [root, files])

  return imported
}
