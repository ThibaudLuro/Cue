import { useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { PauseIcon, PlayIcon, RefreshIcon } from '../components/icons'
import { Spinner, Tag } from '../components/ui'
import type { Bar, EnergyLevel } from '../lib/waveform'
import { CuePads } from './CuePads'
import { resetLabel } from './cueSource'
import { barBeat, cueLetter, folderPath, formatCueTime, formatTime, MOODS, snapToGrid, waveBars } from './model'
import { Overline } from './Overline'
import type { KeyPrep } from './useKeyPrep'

// Flat placeholder while the waveform is being read from the key.
const WAITING_BARS: Bar[] = Array.from({ length: 160 }, () => ({ height: 0.04, level: 'low' }))

const barColor: Record<EnergyLevel, string> = {
  high: 'bg-accent',
  mid: 'bg-subtle',
  low: 'bg-wave-lo',
}

export function TrackEditor({ prep }: { prep: KeyPrep }) {
  const { track, player } = prep
  const duration = player.duration || track.duration

  return (
    <section
      aria-label="Selected track"
      className="relative flex shrink-0 flex-col overflow-x-hidden overflow-y-auto rounded-xl border border-line bg-surface md:max-h-[58vh] xl:flex-row"
    >
      <div className="min-w-0 flex-1 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label={player.playing ? 'Pause' : 'Play track'}
              title="Espace"
              onClick={player.toggle}
              disabled={player.loading}
              className={`flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border text-fg transition active:scale-[0.96] disabled:cursor-wait disabled:opacity-60 ${player.playing ? 'border-accent text-accent' : 'border-control hover:border-subtle'}`}
            >
              {player.playing ? <PauseIcon width={16} height={16} /> : <PlayIcon width={16} height={16} />}
            </button>
            <div className="flex min-w-0 flex-col">
              <NameInput
                key={`${track.id}-title-${track.title}`}
                label="Title"
                value={track.title}
                onCommit={(value) => prep.renameTrack('title', value)}
                className="text-base font-semibold text-fg"
              />
              <NameInput
                key={`${track.id}-artist-${track.artist}`}
                label="Artist"
                value={track.artist}
                onCommit={(value) => prep.renameTrack('artist', value)}
                className="text-[13px] text-subtle"
              />
              {player.error && <p className="truncate px-1.5 text-[13px] text-accent">{player.error}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag>{track.bpm ?? '—'} BPM</Tag>
            <Tag>{track.key}</Tag>
            <Tag>
              <span className="tabular-nums">
                {player.time > 0 && `${formatTime(player.time)} / `}
                {duration ? formatTime(duration) : '—'}
              </span>
            </Tag>
            <button
              type="button"
              onClick={prep.resetTrackCues}
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[13px] text-muted transition-colors hover:text-fg"
            >
              <RefreshIcon width={14} height={14} />
              {resetLabel(track)}
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
  const { track, player } = prep
  const wave = prep.waveform.wave
  const { sections } = track
  const duration = player.duration || track.duration

  const area = useRef<HTMLDivElement>(null)
  // A cue being dragged: where it would land, and whether the pointer moved at all (a plain
  // click on its flag just jumps to it).
  const [drag, setDrag] = useState<{ index: number; position: number; startX: number; moved: boolean } | null>(null)

  function positionAt(clientX: number) {
    const box = area.current?.getBoundingClientRect()
    return box ? Math.min(0.999, Math.max(0, (clientX - box.left) / box.width)) : 0
  }

  function seekTo(event: MouseEvent<HTMLDivElement>) {
    player.seek(positionAt(event.clientX))
  }

  function startDrag(event: PointerEvent<HTMLSpanElement>, index: number, position: number) {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({ index, position, startX: event.clientX, moved: false })
  }

  function moveDrag(event: PointerEvent<HTMLSpanElement>) {
    if (!drag) return
    // A few pixels of slack so a click does not move the cue.
    const moved = drag.moved || Math.abs(event.clientX - drag.startX) > 3
    if (!moved) return
    const raw = positionAt(event.clientX)
    setDrag({ ...drag, moved, position: event.altKey ? raw : snapToGrid(track, raw) })
  }

  function endDrag(event: PointerEvent<HTMLSpanElement>) {
    if (!drag) return
    if (drag.moved) prep.moveCue(drag.index, drag.position, false)
    else prep.selectCue(drag.index)
    event.currentTarget.releasePointerCapture(event.pointerId)
    setDrag(null)
  }

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!direction || !duration) return
    event.preventDefault()
    // Shift: the selected cue moves by one beat (one bar with Alt too). Otherwise the playhead, by 5 s.
    if (event.shiftKey) prep.nudgeCue(direction * (event.altKey ? 4 : 1))
    else player.seek(Math.min(1, Math.max(0, (player.time + direction * 5) / duration)))
  }

  return (
    <>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(player.time)}
        aria-valuetext={formatTime(player.time)}
        ref={area}
        title="Click: play from here · double-click: add a hot cue · Shift + ← →: move the selected cue"
        onClick={seekTo}
        onDoubleClick={(event) => prep.addCueAt(positionAt(event.clientX), !event.altKey)}
        onKeyDown={onKey}
        className="relative mt-11 h-32 cursor-pointer rounded-xs outline-offset-4 focus-visible:outline-2 focus-visible:outline-accent"
      >
        {/* Keyed so the waveform fades in when it arrives or the selection changes. */}
        <div
          key={`${track.id}-${wave ? 'wave' : 'waiting'}`}
          aria-hidden="true"
          className={`absolute inset-0 flex items-center gap-0.5 motion-safe:animate-fade-in ${wave ? '' : 'opacity-60'}`}
        >
          {(wave ? waveBars(wave) : WAITING_BARS).map((bar, i) => (
            // Below lg there is not enough room for 160 bars: keep one in two.
            <span
              key={i}
              className={`min-w-px flex-1 rounded-[1px] max-lg:odd:hidden ${wave ? barColor[bar.level] : 'bg-line-strong'}`}
              style={{ height: `${bar.height * 100}%` }}
            />
          ))}
        </div>
        {track.cues.map((cue, i) => {
          if (!cue) return null
          const active = i === prep.activeCue
          const dragged = drag?.index === i
          const position = dragged ? drag.position : cue.position
          const grid = barBeat(track, position)
          return (
            <div
              key={`${track.id}-${i}`}
              aria-hidden="true"
              className={`absolute -top-[30px] bottom-0 ${dragged ? 'z-10' : 'transition-[left] duration-300 ease-fluid'} ${active || dragged ? 'w-0.5 bg-fg' : 'w-px bg-accent'}`}
              style={{ left: `${position * 100}%` }}
            >
              <span
                title={`Hot cue ${cueLetter(i)} · drag to move (Alt: don’t snap to the beat)`}
                onPointerDown={(event) => startDrag(event, i, cue.position)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={() => setDrag(null)}
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
                className={`absolute top-0 left-0 flex size-[22px] touch-none items-center justify-center rounded-[5px] text-[11px] font-semibold text-canvas select-none ${dragged ? 'cursor-grabbing' : 'cursor-grab'} ${active || dragged ? 'bg-fg' : 'bg-accent'}`}
              >
                {cueLetter(i)}
              </span>
              {dragged && drag.moved && (
                <span className="pointer-events-none absolute -top-[30px] left-1/2 -translate-x-1/2 rounded-md border border-line-strong bg-surface px-2 py-0.5 text-[11px] whitespace-nowrap text-fg tabular-nums">
                  {formatCueTime(position * duration)}
                  {grid && ` · bar ${grid.bar}.${grid.beat}`}
                </span>
              )}
            </div>
          )
        })}
        {player.time > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-y-1 w-0.5 rounded-full bg-fg shadow-[0_0_0_2px_var(--color-canvas)]"
            style={{ left: `${player.position * 100}%` }}
          />
        )}
      </div>
      <div aria-label="Track structure" className="mt-2 flex border-t border-line-strong">
        {sections.map((section) => (
          <span
            key={section.label}
            className="truncate pt-2 pl-1.5 text-[11px] text-muted"
            style={{ width: `${(section.end - section.start) * 100}%` }}
          >
            {section.label}
          </span>
        ))}
        {/* Until this track is analysed, say why its parts and cues are missing. */}
        {sections.length === 0 && track.analysis !== 'done' && (
          <span className="flex items-center gap-1.5 pt-2 pl-1.5 text-[11px] text-muted">
            {track.analysis === 'failed' ? (
              'Analysis failed: unreadable file'
            ) : (
              <>
                <Spinner className="size-3 text-accent" />
                {track.analysis === 'running'
                  ? 'Analysing this track: BPM, key, sections and hot cues on their way…'
                  : 'Waiting for analysis: sections and hot cues will show up next'}
              </>
            )}
          </span>
        )}
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
          Energy
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
          Detection: <span className="text-data">{track.confidence}</span>
        </p>
      </div>

      <div>
        <Overline className="mb-2">Filed in</Overline>
        <p className="rounded-lg border border-line bg-canvas px-3 py-2.5 text-xs text-data tabular-nums">
          {folderPath(track, prep.grouping, prep.key.name)}
        </p>
        <p className="mt-2 text-xs text-subtle">Changing the energy moves the track.</p>
      </div>
    </div>
  )
}

// Reads as plain text, edits in place. Saved on Enter or when leaving the field; Escape cancels.
function NameInput({
  label,
  value,
  onCommit,
  className,
}: {
  label: string
  value: string
  onCommit: (value: string) => void
  className: string
}) {
  const [draft, setDraft] = useState(value)

  return (
    <input
      type="text"
      aria-label={label}
      title={`Edit ${label.toLowerCase()}`}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        onCommit(draft)
        // Emptied: back to the name read from the file (a renamed track remounts on its own).
        if (!draft.trim()) setDraft(value)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          setDraft(value)
          // Leaves the field without saving the draft.
          requestAnimationFrame(() => (document.activeElement as HTMLElement | null)?.blur())
        }
      }}
      className={`w-full min-w-0 truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 outline-none transition-colors hover:border-line-strong focus:border-accent focus:bg-canvas ${className}`}
    />
  )
}
