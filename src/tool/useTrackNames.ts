import { useEffect, useState } from 'react'
import { idbGetAll, idbSet } from '../lib/idb'

export type TrackName = { title: string; artist: string }
export type NameField = keyof TrackName

// Titles and artists retyped by the DJ, by file path. They win over what the file name says.
export function useTrackNames() {
  const [names, setNames] = useState<Record<string, Partial<TrackName>>>({})

  useEffect(() => {
    idbGetAll<Partial<TrackName>>('names').then(setNames)
  }, [])

  return {
    names,
    // An empty value goes back to the name read from the file.
    rename(path: string, field: NameField, value: string) {
      const name = { ...names[path], [field]: value.trim() || undefined }
      setNames((all) => ({ ...all, [path]: name }))
      idbSet('names', path, name)
    },
  }
}
