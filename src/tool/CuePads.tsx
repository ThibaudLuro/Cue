import { cueLetter, formatTime, PAD_COUNT } from './model'
import { Overline } from './Overline'
import { cueOrigin } from './cueSource'
import type { KeyPrep } from './useKeyPrep'

export function CuePads({ prep }: { prep: KeyPrep }) {
  const { track } = prep
  const cueCount = track.cues.filter(Boolean).length

  return (
    <>
      <Overline className="mt-6">
        Hot cues · {cueCount}/{PAD_COUNT} · {cueOrigin(track)}
      </Overline>

      <div className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
        {track.cues.map((cue, i) => {
          const letter = cueLetter(i)
          if (!cue) {
            return (
              <button
                key={i}
                type="button"
                aria-label={`Add a hot cue on pad ${letter}`}
                onClick={() => prep.addCue(i)}
                className="flex min-h-16 cursor-pointer flex-col justify-between gap-1.5 rounded-lg border border-dashed border-control p-2.5 text-left transition-colors hover:border-subtle"
              >
                <span className="flex items-center justify-between">
                  <span className="flex size-[18px] items-center justify-center rounded-sm bg-line-strong text-[11px] font-semibold text-muted">
                    {letter}
                  </span>
                  <span className="text-[11px] text-subtle">—</span>
                </span>
                <span className="truncate text-[13px] text-subtle">+ Add</span>
              </button>
            )
          }

          const on = i === prep.activeCue
          // The card jumps to the cue; its name is typed in place, the cross deletes it.
          return (
            <div
              key={i}
              className={`group relative flex min-h-16 flex-col justify-between gap-1.5 rounded-lg border p-2.5 text-fg transition-colors ${on ? 'border-fg bg-line' : 'border-line-strong bg-canvas hover:border-control'}`}
            >
              <button
                type="button"
                aria-pressed={on}
                aria-label={`Hot cue ${letter}, ${cue.label}: jump to it`}
                onClick={() => prep.selectCue(i)}
                // Covers the card, under the name field and the cross.
                className="absolute inset-0 cursor-pointer rounded-lg"
              />
              <span className="pointer-events-none relative flex items-center gap-2 pr-5">
                <span
                  className={`flex size-[18px] items-center justify-center rounded-sm text-[11px] font-semibold text-canvas transition-colors ${on ? 'bg-fg' : 'bg-accent'}`}
                >
                  {letter}
                </span>
                <span className="text-[11px] text-subtle tabular-nums">{formatTime(cue.position * track.duration)}</span>
              </span>
              <input
                type="text"
                value={cue.label}
                aria-label={`Name of hot cue ${letter}`}
                onChange={(event) => prep.renameCue(i, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur()
                }}
                spellCheck={false}
                className="relative -mx-1 w-[calc(100%+8px)] min-w-0 truncate rounded-sm border border-transparent bg-transparent px-1 text-[13px] text-fg outline-none transition-colors hover:border-line-strong focus:border-accent focus:bg-canvas"
              />
              <button
                type="button"
                aria-label={`Delete hot cue ${letter}`}
                title="Delete"
                onClick={() => prep.deleteCue(i)}
                className="absolute top-1.5 right-1.5 flex size-5 cursor-pointer items-center justify-center rounded-sm text-sm leading-none text-subtle opacity-60 transition hover:bg-line-strong hover:text-fg hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}
