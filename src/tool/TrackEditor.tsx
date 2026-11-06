import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
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
            {resetLabel(track) && (
              <button
                type="button"
                onClick={prep.resetTrackCues}
                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[13px] text-muted transition-colors hover:text-fg"
              >
                <RefreshIcon width={14} height={14} />
                {resetLabel(track)}
              </button>
            )}
            <button
              type="button"
              onClick={() => prep.reanalyse([track.id])}
              disabled={track.analysis === 'running' || track.analysis === 'pending'}
              title="New analysis of this track: BPM, key, energy, sections and hot cues replace the current setup"
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-control px-3 text-[13px] text-fg transition hover:border-subtle disabled:cursor-default disabled:opacity-50"
            >
              {track.analysis === 'running' ? <Spinner className="size-3.5 text-accent" /> : <RefreshIcon width={14} height={14} />}
              {track.analysis === 'running' ? 'Analysing…' : track.analysis === 'pending' ? 'Queued' : 'Re-analyse'}
            </button>
          </div>
        </div>

        {/* Keyed by track: each track opens unzoomed. */}
        <Waveform key={track.id} prep={prep} />
        <CuePads prep={prep} />
      </div>

      <TrackDetails prep={prep} />
    </section>
  )
}

// Zoom levels: how many times the view is narrower than the whole track.
const ZOOMS = [1, 2, 4, 8, 16, 32]
// Wheel movement for one zoom step: one notch of a mouse wheel.
const WHEEL_STEP = 80

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
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

  // The view: zoom level and where it starts (0 to 1 of the track).
  const [zoom, setZoom] = useState(1)
  const [viewStart, setViewStart] = useState(0)
  const span = 1 / zoom
  const start = clamp(viewStart, 0, 1 - span)
  const end = start + span
  const toView = (position: number) => (position - start) / span
  const inView = (position: number) => position >= start - 0.001 && position <= end + 0.001

  // Zooms on a point of the track (the pointer, the selected cue…), keeping it where it is on screen.
  function zoomTo(level: number, around: number) {
    const next = ZOOMS.find((z) => z >= level) ?? ZOOMS[ZOOMS.length - 1]
    const anchor = toView(around)
    setZoom(next)
    setViewStart(clamp(around - anchor / next, 0, 1 - 1 / next))
  }

  function zoomStep(direction: 1 | -1, around = focus()) {
    const index = ZOOMS.indexOf(zoom) + direction
    if (index < 0 || index >= ZOOMS.length) return
    zoomTo(ZOOMS[index], around)
  }

  // What the zoom buttons centre on: the selected cue if in view, else the playhead, else the middle.
  function focus() {
    const cue = track.cues[prep.activeCue]
    if (cue && inView(cue.position)) return cue.position
    if (player.time > 0 && inView(player.position)) return player.position
    return start + span / 2
  }

  // The wheel zooms on the pointer; Shift + wheel (or a sideways trackpad swipe) moves along.
  // Trackpads send many small deltas: they add up to one zoom step per notch of a mouse wheel.
  // Native listener: React's wheel handlers cannot stop the page from scrolling.
  const wheelTotal = useRef(0)
  useEffect(() => {
    const element = area.current
    if (!element) return
    function onWheel(event: WheelEvent) {
      event.preventDefault()
      const box = element!.getBoundingClientRect()
      const sideways = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)
      if (sideways) {
        const delta = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX
        if (zoom > 1) setViewStart(clamp(start + (delta / box.width) * span, 0, 1 - span))
        return
      }
      wheelTotal.current += event.deltaY
      if (Math.abs(wheelTotal.current) < WHEEL_STEP) return
      const at = start + clamp((event.clientX - box.left) / box.width, 0, 1) * span
      zoomStep(wheelTotal.current < 0 ? 1 : -1, at)
      wheelTotal.current = 0
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  })

  // While playing, the view turns the page when the playhead reaches its edge. Adjusted during
  // render (React's way of syncing state with a changing value), not in an effect.
  const position = player.position
  if (zoom > 1 && player.playing && (position > end || position < start)) {
    setViewStart(clamp(position - span * 0.1, 0, 1 - span))
  }

  // Picking or moving a cue elsewhere (pads, keyboard) brings it into view.
  const activePosition = track.cues[prep.activeCue]?.position
  const activeKey = `${prep.activeCue}:${activePosition}`
  const [seenCue, setSeenCue] = useState(activeKey)
  if (activeKey !== seenCue) {
    setSeenCue(activeKey)
    if (zoom > 1 && !drag && activePosition !== undefined && !inView(activePosition)) {
      setViewStart(clamp(activePosition - span / 2, 0, 1 - span))
    }
  }

  function positionAt(clientX: number) {
    const box = area.current?.getBoundingClientRect()
    return box ? clamp(start + ((clientX - box.left) / box.width) * span, 0, 0.999) : 0
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
    if (event.key === '+' || event.key === '=') return zoomStep(1)
    if (event.key === '-') return zoomStep(-1)
    const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!direction || !duration) return
    event.preventDefault()
    // Shift: the selected cue moves by one beat (one bar with Alt too). Otherwise the playhead,
    // by 5 s, or by a tenth of the view once zoomed in.
    const step = zoom > 1 ? (span * duration) / 10 : 5
    if (event.shiftKey) prep.nudgeCue(direction * (event.altKey ? 4 : 1))
    else player.seek(clamp((player.time + direction * step) / duration, 0, 1))
  }

  // Beat lines once zoomed in: bars from 4×, every beat from 8×.
  const gridLines: { left: number; bar: boolean }[] = []
  if (zoom >= 4 && track.bpm && track.beat !== null && duration) {
    const beatLength = 60 / track.bpm
    const downbeat = track.downbeat ?? track.beat
    const from = start * duration
    const to = end * duration
    for (let n = Math.ceil((from - downbeat) / beatLength); downbeat + n * beatLength <= to; n++) {
      const bar = ((n % 4) + 4) % 4 === 0
      if (!bar && zoom < 8) continue
      gridLines.push({ left: toView((downbeat + n * beatLength) / duration), bar })
    }
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
        title="Click: play from here · double-click: add a hot cue · scroll: zoom · Shift + scroll: move along · Shift + ← →: move the selected cue"
        onClick={seekTo}
        onDoubleClick={(event) => prep.addCueAt(positionAt(event.clientX), !event.altKey)}
        onKeyDown={onKey}
        className="relative mt-11 h-32 cursor-pointer rounded-xs outline-offset-4 focus-visible:outline-2 focus-visible:outline-accent"
      >
        {gridLines.map((line, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-0 w-px ${line.bar ? 'bg-subtle/50' : 'bg-line-strong'}`}
            style={{ left: `${line.left * 100}%` }}
          />
        ))}
        {/* Keyed so the waveform fades in when it arrives or the selection changes. */}
        <div
          key={`${track.id}-${wave ? 'wave' : 'waiting'}`}
          aria-hidden="true"
          className={`absolute inset-0 flex items-center gap-0.5 motion-safe:animate-fade-in ${wave ? '' : 'opacity-60'}`}
        >
          {(wave ? waveBars(wave, 160, start, end) : WAITING_BARS).map((bar, i) => (
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
          const at = dragged ? drag.position : cue.position
          if (!inView(at)) return null
          const grid = barBeat(track, at)
          return (
            <div
              key={`${track.id}-${i}`}
              aria-hidden="true"
              className={`absolute -top-[30px] bottom-0 ${dragged ? 'z-10' : zoom === 1 ? 'transition-[left] duration-300 ease-fluid' : ''} ${active || dragged ? 'w-0.5 bg-fg' : 'w-px bg-accent'}`}
              style={{ left: `${toView(at) * 100}%` }}
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
                  {formatCueTime(at * duration)}
                  {grid && ` · bar ${grid.bar}.${grid.beat}`}
                </span>
              )}
            </div>
          )
        })}
        {player.time > 0 && inView(player.position) && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-y-1 w-0.5 rounded-full bg-fg shadow-[0_0_0_2px_var(--color-canvas)]"
            style={{ left: `${toView(player.position) * 100}%` }}
          />
        )}
      </div>

      {/* The whole track: its parts, and the window the zoomed-in view shows. */}
      <div aria-label="Track structure" className="relative mt-2 flex border-t border-line-strong">
        {zoom > 1 && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-px bottom-0 rounded-b-xs border-t-2 border-accent bg-accent/10"
            style={{ left: `${start * 100}%`, width: `${span * 100}%` }}
          />
        )}
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
            ) : track.analysis === 'kept' ? (
              'Setup taken from the stick · Re-analyse to detect sections'
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

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-subtle">
        {zoom > 1 && (
          <>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="h-7 cursor-pointer rounded-md border border-line-strong px-2.5 text-fg transition-colors hover:border-subtle"
            >
              Reset zoom <span className="text-subtle tabular-nums">· {zoom}×</span>
            </button>
            <span className="tabular-nums">
              {formatTime(start * duration)}–{formatTime(end * duration)}
            </span>
          </>
        )}
        <span className="ml-auto max-sm:hidden">
          Scroll to zoom{zoom > 1 ? ' · Shift + scroll to move along' : ''}
        </span>
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
