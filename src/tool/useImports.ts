import { useEffect, useState } from 'react'
import { readImports, type Imported } from './imports'
import type { KeyFile } from './usbKey'

type Found = { tracks: Record<string, Imported>; mount: string | null }

// What rekordbox (or an earlier Cue export) left on the key, read each time the key is read.
// ready: the key's files were looked at (found or not), so the analysis knows what to skip.
export function useImports(root: FileSystemDirectoryHandle | null, files: KeyFile[]) {
  const [imported, setImported] = useState<Found & { files: KeyFile[] | null }>({ tracks: {}, mount: null, files: null })

  useEffect(() => {
    if (!root || files.length === 0) return
    let cancelled = false
    readImports(root, files)
      .catch((): Found => ({ tracks: {}, mount: null }))
      .then((found) => {
        if (!cancelled) setImported({ ...found, files })
      })
    return () => {
      cancelled = true
    }
  }, [root, files])

  return { tracks: imported.tracks, mount: imported.mount, ready: imported.files === files }
}
