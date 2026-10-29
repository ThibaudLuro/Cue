import { PlayIcon, RefreshIcon } from '../components/icons'
import { Tag } from '../components/ui'
import type { EnergyLevel } from '../lib/waveform'
import { CuePads } from './CuePads'
import { cueLetter, folderPath, formatTime, MOODS, trackSections, trackWave } from './model'
import { Overline } from './Overline'
import type { KeyPrep } from './useKeyPrep'

const barColor: Record<EnergyLevel, string> = {
  high: 'bg-accent',
  mid: 'bg-subtle',
  low: 'bg-wave-lo',
}

export function TrackEditor({ prep }: { prep: KeyPrep }) {
  const { track } = prep

  return (
    <section
      aria-label="Morceau sélectionné"
      className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface xl:flex-row"
    >
      <div className="min-w-0 flex-1 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Lire le morceau"
              className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-control text-fg transition hover:border-subtle active:scale-[0.96]"
            >
              <PlayIcon width={16} height={16} />
            </button>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{track.title}</p>
              <p className="truncate text-[13px] text-subtle">{track.artist}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag>{track.bpm} BPM</Tag>
            <Tag>{track.key}</Tag>
            <Tag>{formatTime(track.duration)}</Tag>
            <button
              type="button"
              onClick={prep.resetTrackCues}
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[13px] text-muted transition-colors hover:text-fg"
            >
              <RefreshIcon width={14} height={14} />
              Replacer auto
            </button>
          </div>
        </div>

        <Waveform prep={prep} />
        <CuePads prep={prep} />
      </div>

      <TrackDetails prep={prep} />
    </section>
  )
}

function Waveform({ prep }: { prep: KeyPrep }) {
  const { track } = prep
  const sections = trackSections(track)

  return (
    <>
      <div className="relative mt-11 h-32">
        {/* Keyed by track so the new waveform fades in when the selection changes. */}
        <div
          key={track.id}
          aria-hidden="true"
          className="absolute inset-0 flex items-center gap-0.5 motion-safe:animate-fade-in"
        >
          {trackWave(track).map((bar, i) => (
            // Below lg there is not enough room for 160 bars: keep one in two.
            <span
              key={i}
              className={`min-w-px flex-1 rounded-[1px] max-lg:odd:hidden ${barColor[bar.level]}`}
              style={{ height: `${bar.height * 100}%` }}
            />
          ))}
        </div>
        {track.cues.map((cue, i) => {
          if (!cue) return null
          const active = i === prep.activeCue
          return (
            <div
              key={`${track.id}-${i}`}
              aria-hidden="true"
              className={`absolute -top-[30px] bottom-0 transition-[left] duration-300 ease-fluid ${active ? 'w-0.5 bg-fg' : 'w-px bg-accent'}`}
              style={{ left: `${cue.position * 100}%` }}
            >
              <span
                className={`absolute top-0 left-0 flex size-[22px] items-center justify-center rounded-[5px] text-[11px] font-semibold text-canvas ${active ? 'bg-fg' : 'bg-accent'}`}
              >
                {cueLetter(i)}
              </span>
            </div>
          )
        })}
      </div>
      <div aria-label="Structure du morceau" className="mt-2 flex border-t border-line-strong">
        {sections.map((section) => (
          <span
            key={section.label}
            className="truncate pt-2 pl-1.5 text-[11px] text-muted"
            style={{ width: `${(section.end - section.start) * 100}%` }}
          >
            {section.label}
          </span>
        ))}
      </div>
    </>
  )
}

function TrackDetails({ prep }: { prep: KeyPrep }) {
  const { track } = prep

  return (
    <div className="flex flex-col gap-[22px] border-t border-line p-5 xl:w-[260px] xl:shrink-0 xl:border-t-0 xl:border-l">
      <div>
        <Overline id="mood-label" className="mb-2.5">
          Ambiance
        </Overline>
        <div role="group" aria-labelledby="mood-label" className="flex flex-wrap gap-1.5">
          {MOODS.map((mood) => {
            const on = mood === track.mood
            return (
              <button
                key={mood}
                type="button"
                aria-pressed={on}
                onClick={() => prep.changeMood(mood)}
                className={`h-8 cursor-pointer rounded-full border px-3 text-[13px] transition-colors ${on ? 'border-accent bg-accent font-semibold text-canvas' : 'border-control text-data hover:border-subtle'}`}
              >
                {mood}
              </button>
            )
          })}
        </div>
        <p className="mt-2.5 text-xs text-subtle">
          Détection : <span className="text-data">{track.confidence}</span>
        </p>
      </div>

      <div>
        <Overline className="mb-2.5">Énergie</Overline>
        <div role="img" aria-label={`Énergie ${track.energy} sur 5`} className="flex gap-1">
          {[1, 2, 3, 4, 5].map((level) => (
            <span
              key={level}
              className={`h-2 flex-1 rounded-[2px] transition-colors ${level <= track.energy ? 'bg-data' : 'bg-line-strong'}`}
            />
          ))}
        </div>
      </div>

      <div>
        <Overline className="mb-2">Rangé dans</Overline>
        <p className="rounded-lg border border-line bg-canvas px-3 py-2.5 text-xs text-data tabular-nums">
          {folderPath(track, prep.grouping)}
        </p>
        <p className="mt-2 text-xs text-subtle">Changer l’ambiance déplace le morceau.</p>
      </div>
    </div>
  )
}
