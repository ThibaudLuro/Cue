import { useEffect, useRef } from 'react'
import type { KeyPrep } from './useKeyPrep'

// Saving does not reach the CDJs on its own: rekordbox has to import what Cue writes. This
// bubble says how, next to the save button, since nothing in the workflow makes it obvious.
export function SaveHelp({ prep, open, onOpenChange }: { prep: KeyPrep; open: boolean; onOpenChange: (open: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null)

  // Closes on a click elsewhere or on Escape.
  useEffect(() => {
    if (!open) return
    function onPointer(event: PointerEvent) {
      if (!box.current?.contains(event.target as Node)) onOpenChange(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

  const file = `${prep.location || ''}CUE/rekordbox.xml`

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="save-help"
        aria-label="How saving works"
        title="How saving works"
        onClick={() => onOpenChange(!open)}
        className={`flex size-9 cursor-pointer items-center justify-center rounded-full border text-sm font-semibold transition-colors ${open ? 'border-accent text-fg' : 'border-control text-muted hover:border-subtle hover:text-fg'}`}
      >
        ?
      </button>

      {open && (
        <div
          id="save-help"
          role="dialog"
          aria-label="How saving works"
          className="absolute top-[calc(100%+10px)] right-0 z-30 w-[min(420px,calc(100vw-32px))] rounded-xl border border-line-strong bg-surface p-4 text-[13px] leading-[1.55] text-muted shadow-[0_16px_40px_rgb(0_0_0/0.45)] motion-safe:animate-fade-in"
        >
          {/* Arrow pointing at the button. */}
          <span
            aria-hidden="true"
            className="absolute -top-[6px] right-[13px] size-[10px] rotate-45 border-t border-l border-line-strong bg-surface"
          />
          <p className="font-semibold text-fg">How saving works</p>
          <p className="mt-1">
            <span className="text-fg">Save to the stick</span> writes one file, <code className="text-data">{file}</code>. Your
            audio files are never changed. rekordbox then imports it, and its export is what CDJs read.
          </p>

          <p className="mt-3 text-[11px] font-medium tracking-[0.06em] text-subtle uppercase">Once, in rekordbox</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>
              Preferences › View › Layout: tick <span className="text-fg">rekordbox xml</span>.
            </li>
            <li>
              Preferences › Advanced › Database › rekordbox xml › Imported Library: browse to{' '}
              <code className="text-data">{file}</code>.
            </li>
          </ol>

          <p className="mt-3 text-[11px] font-medium tracking-[0.06em] text-subtle uppercase">After each save</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            <li>
              In the tree on the left, refresh <span className="text-fg">rekordbox xml</span>.
            </li>
            <li>
              Open Playlists › <span className="text-fg">Cue · {prep.key.name}</span>, right-click › Import Playlist.
            </li>
            <li>For the CDJs: right-click the imported playlist › Export to your stick.</li>
          </ol>

          <p className="mt-3 rounded-lg border border-line bg-canvas px-3 py-2 text-xs">
            Tracks already in your rekordbox collection may keep rekordbox’s own grid and cues. Remove them from the
            collection, then import again to take Cue’s.
          </p>
          <p className="mt-2 text-xs text-subtle">Menu names can vary slightly between rekordbox versions.</p>
        </div>
      )}
    </div>
  )
}
