import { useEffect } from 'react'
import { Sidebar } from '../tool/Sidebar'
import { ToolHeader } from '../tool/ToolHeader'
import { TrackEditor } from '../tool/TrackEditor'
import { TrackList } from '../tool/TrackList'
import { useKeyPrep } from '../tool/useKeyPrep'

export function Tool() {
  const prep = useKeyPrep()

  useEffect(() => {
    document.title = 'Cue — Préparer ma clé'
    // Coming from the landing, the browser would keep its scroll position.
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-sm leading-[1.45] text-fg">
      <ToolHeader prep={prep} />
      <div className="flex flex-1 flex-col md:flex-row">
        <Sidebar prep={prep} />
        <main className="flex min-w-0 flex-1 flex-col gap-4 px-6 pt-5 pb-6">
          <TrackList prep={prep} />
          <TrackEditor prep={prep} />
        </main>
      </div>
    </div>
  )
}
