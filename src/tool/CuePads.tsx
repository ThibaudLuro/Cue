import { cueLetter, formatTime, PAD_COUNT } from './model'
import { Overline } from './Overline'
import type { KeyPrep } from './useKeyPrep'

const smallButton =
  'h-[34px] cursor-pointer rounded-md border border-control px-2.5 text-[13px] text-fg transition hover:border-subtle active:scale-[0.97]'

export function CuePads({ prep }: { prep: KeyPrep }) {
  const { track } = prep
  const cueCount = track.cues.filter(Boolean).length
  const active = track.cues[prep.activeCue]

  return (
    <>
      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3">
        <Overline>
          Hot cues · {cueCount}/{PAD_COUNT}
        </Overline>
        <span className="text-xs text-subtle">Cliquez un pad pour le modifier, un pad libre pour en ajouter un</span>
      </div>

      <div className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
        {track.cues.map((cue, i) => {
          const letter = cueLetter(i)
          if (!cue) {
            return (
              <button
                key={i}
                type="button"
                aria-label={`Ajouter un hot cue sur le pad ${letter}`}
                onClick={() => prep.addCue(i)}
                className="flex min-h-16 cursor-pointer flex-col justify-between gap-1.5 rounded-lg border border-dashed border-control p-2.5 text-left transition-colors hover:border-subtle"
              >
                <span className="flex items-center justify-between">
                  <span className="flex size-[18px] items-center justify-center rounded-sm bg-line-strong text-[11px] font-semibold text-muted">
                    {letter}
                  </span>
                  <span className="text-[11px] text-subtle">—</span>
                </span>
                <span className="truncate text-[13px] text-subtle">+ Ajouter</span>
              </button>
            )
          }

          const on = i === prep.activeCue
          return (
            <button
              key={i}
              type="button"
              aria-pressed={on}
              aria-label={`Hot cue ${letter}, ${cue.label}`}
              onClick={() => prep.selectCue(i)}
              className={`flex min-h-16 cursor-pointer flex-col justify-between gap-1.5 rounded-lg border p-2.5 text-left text-fg transition-colors ${on ? 'border-fg bg-line' : 'border-line-strong bg-canvas hover:border-control'}`}
            >
              <span className="flex items-center justify-between">
                <span
                  className={`flex size-[18px] items-center justify-center rounded-sm text-[11px] font-semibold text-canvas transition-colors ${on ? 'bg-fg' : 'bg-accent'}`}
                >
                  {letter}
                </span>
                <span className="text-[11px] text-subtle tabular-nums">{formatTime(cue.position * track.duration)}</span>
              </span>
              <span className="truncate text-[13px]">{cue.label}</span>
            </button>
          )
        })}
      </div>

      {active && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[10px] border border-line-strong bg-canvas p-3">
          <span className="flex size-6 items-center justify-center rounded-[5px] bg-fg text-xs font-semibold text-canvas">
            {cueLetter(prep.activeCue)}
          </span>
          <label className="flex items-center gap-2 text-[13px] text-muted">
            Nom
            <input
              type="text"
              value={active.label}
              onChange={(event) => prep.renameCue(event.target.value)}
              className="h-[34px] w-[140px] rounded-md border border-control bg-surface px-2.5 text-[13px] text-fg"
            />
          </label>
          <span className="px-2 text-[13px] text-data tabular-nums">{formatTime(active.position * track.duration)}</span>
          <button type="button" onClick={() => prep.nudgeCue(-1)} className={smallButton}>
            − 1 temps
          </button>
          <button type="button" onClick={() => prep.nudgeCue(1)} className={smallButton}>
            + 1 temps
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={prep.deleteCue}
            className="h-[34px] cursor-pointer rounded-md px-2.5 text-[13px] text-danger transition-opacity hover:opacity-80"
          >
            Supprimer
          </button>
        </div>
      )}
    </>
  )
}
