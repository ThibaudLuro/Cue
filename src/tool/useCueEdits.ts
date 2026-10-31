import { useEffect, useState } from 'react'
import { idbDelete, idbGetAll, idbSet } from '../lib/idb'
import type { CueSlots } from './model'

// at: when the DJ last changed them, to compare with what rekordbox wrote on the key.
export type CueEdit = { cues: CueSlots; at: number }

// Hot cues placed or moved by the DJ, by file path. They win over the automatic placement
// and are kept between visits.
export function useCueEdits() {
  const [edits, setEdits] = useState<Record<string, CueEdit>>({})

  useEffect(() => {
    idbGetAll<CueEdit | CueSlots>('cues').then((stored) => {
      // Saved before edits had a date: older than anything.
      const read = Object.fromEntries(
        Object.entries(stored).map(([path, value]) => [path, Array.isArray(value) ? { cues: value, at: 0 } : value]),
      )
      setEdits((current) => ({ ...read, ...current }))
    })
  }, [])

  return {
    edits,
    set(path: string, cues: CueSlots) {
      const edit = { cues, at: Date.now() }
      setEdits((all) => ({ ...all, [path]: edit }))
      idbSet('cues', path, edit)
    },
    // Back to the cues found on the key, or the automatic placement.
    drop(paths: string[]) {
      setEdits((all) => Object.fromEntries(Object.entries(all).filter(([path]) => !paths.includes(path))))
      for (const path of paths) idbDelete('cues', path)
    },
  }
}
