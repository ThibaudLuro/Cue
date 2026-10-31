import { useRef, type KeyboardEvent } from 'react'
import { SearchIcon } from '../components/icons'
import { folderSegments, formatTime, MOODS, plural } from './model'
import type { KeyPrep, KeyTrack } from './useKeyPrep'

const columns = 'grid grid-cols-[32px_minmax(0,1fr)_56px_48px_130px_76px_92px_104px_56px] gap-3'
const checkbox = 'size-4 cursor-pointer accent-accent'

export function TrackList({ prep }: { prep: KeyPrep }) {
  const [parent, name] = prep.isSearching ? ['Recherche', `« ${prep.query} »`] : folderSegments(prep.folder)
  const scroller = useRef<HTMLDivElement>(null)

  // ↑ ↓ go through the list without the mouse; the selected row stays in view.
  function moveSelection(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    if (!step || prep.visible.length === 0) return
    event.preventDefault()
    const index = prep.visible.findIndex((t) => t.id === prep.track.id)
    const next = prep.visible[Math.min(prep.visible.length - 1, Math.max(0, index + step))]
    prep.selectTrack(next.id)
    requestAnimationFrame(() => {
      const row = scroller.current?.querySelector<HTMLElement>(`[data-track="${CSS.escape(next.id)}"]`)
      row?.focus({ preventScroll: true })
      row?.scrollIntoView({ block: 'nearest' })
    })
  }

  return (
    // From md up, the list fills what the editor leaves and scrolls on its own.
    <section aria-label="Morceaux" className="flex flex-col gap-3 md:min-h-0 md:flex-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
            <span className="font-medium text-subtle">{parent} / </span>
            {name}
          </h1>
          <p className="mt-0.5 text-[13px] text-subtle">{plural(prep.visible.length, 'morceau', 'morceaux')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="flex h-[38px] items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 transition-colors focus-within:border-accent">
            <SearchIcon width={14} height={14} className="text-subtle" />
            <span className="sr-only">Rechercher sur la clé</span>
            <input
              type="search"
              value={prep.query}
              onChange={(event) => prep.search(event.target.value)}
              placeholder="Titre, artiste, ambiance"
              className="w-[200px] bg-transparent text-[13px] text-fg outline-none placeholder:text-subtle"
            />
          </label>
          <button
            type="button"
            onClick={prep.resetVisibleCues}
            className="h-[38px] cursor-pointer rounded-lg border border-control px-3.5 text-[13px] text-fg transition hover:border-subtle active:scale-[0.98]"
          >
            Replacer les hot cues
          </button>
        </div>
      </div>

      {prep.checked.length > 0 && <SelectionBar prep={prep} />}

      <div
        ref={scroller}
        onKeyDown={moveSelection}
        className="overflow-auto rounded-xl border border-line bg-surface md:min-h-0 md:flex-1"
      >
        <div className="min-w-[900px]">
          <div className="sticky top-0 z-10 grid grid-cols-[44px_minmax(0,1fr)] items-center border-b border-line bg-surface">
            <span className="flex justify-center">
              <input
                type="checkbox"
                aria-label="Tout sélectionner"
                checked={prep.allChecked}
                onChange={prep.toggleAll}
                className={checkbox}
              />
            </span>
            <div aria-hidden="true" className={`${columns} py-2.5 pr-4 text-[11px] tracking-[0.06em] text-subtle uppercase`}>
              <span>#</span>
              <span>Titre</span>
              <span>BPM</span>
              <span>Clé</span>
              <span>Ambiance</span>
              <span>Énergie</span>
              <span>Hot cues</span>
              <span>État</span>
              <span>Durée</span>
            </div>
          </div>

          {prep.visible.map((track, i) => (
            <TrackRow key={track.id} prep={prep} track={track} index={i} />
          ))}

          {prep.visible.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-subtle">
              {prep.isSearching ? `Aucun morceau ne correspond à « ${prep.query} ».` : 'Ce dossier est vide.'}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

function SelectionBar({ prep }: { prep: KeyPrep }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-line-strong bg-surface px-3 py-2 text-[13px] motion-safe:animate-rise">
      <span className="font-medium">{plural(prep.checked.length, 'morceau sélectionné', 'morceaux sélectionnés')}</span>
      <label className="flex items-center gap-2 text-muted">
        Appliquer l’ambiance
        <select
          value=""
          onChange={(event) => prep.moodForChecked(event.target.value)}
          className="h-8 cursor-pointer rounded-md border border-control bg-surface px-2 text-[13px] text-fg"
        >
          <option value="">Choisir…</option>
          {MOODS.map((mood) => (
            <option key={mood} value={mood}>
              {mood}
            </option>
          ))}
        </select>
      </label>
      <div className="flex-1" />
      <button
        type="button"
        onClick={prep.clearChecked}
        className="h-8 cursor-pointer rounded-md px-3 text-[13px] text-muted transition-colors hover:text-fg"
      >
        Désélectionner
      </button>
    </div>
  )
}

function trackState(track: KeyTrack, saved: boolean) {
  if (!track.mood) {
    if (track.analysis === 'running') return { label: 'Analyse…', text: 'text-data', dot: 'bg-data motion-safe:animate-pulse' }
    if (track.analysis === 'pending') return { label: 'À analyser', text: 'text-subtle', dot: 'bg-idle' }
    if (track.analysis === 'failed') return { label: 'Illisible', text: 'text-accent', dot: 'bg-accent' }
    return { label: 'À confirmer', text: 'text-accent', dot: 'bg-fg' }
  }
  return saved
    ? { label: 'Sur la clé', text: 'text-muted', dot: 'bg-subtle' }
    : { label: 'Prêt', text: 'text-muted', dot: 'bg-accent' }
}

function TrackRow({ prep, track, index }: { prep: KeyPrep; track: KeyTrack; index: number }) {
  const current = track.id === prep.track.id
  const isChecked = prep.checked.includes(track.id)
  const state = trackState(track, prep.status === 'saved')
  const cueCount = track.cues.filter(Boolean).length
  const background = current ? 'bg-row' : isChecked ? 'bg-row-checked' : 'hover:bg-row-checked'

  return (
    <div className={`grid grid-cols-[44px_minmax(0,1fr)] items-center border-t border-row transition-colors ${background}`}>
      <span className="flex justify-center">
        <input
          type="checkbox"
          aria-label={`Sélectionner ${track.title}`}
          checked={isChecked}
          onChange={() => prep.toggleChecked(track.id)}
          className={checkbox}
        />
      </span>
      <button
        type="button"
        aria-pressed={current}
        data-track={track.id}
        onClick={() => prep.selectTrack(track.id)}
        className={`${columns} min-h-[52px] w-full cursor-pointer items-center py-2 pr-4 text-left text-fg`}
      >
        <span className="text-xs text-subtle tabular-nums">{String(index + 1).padStart(2, '0')}</span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm">{track.title}</span>
          <span className="truncate text-xs text-subtle">{track.artist}</span>
        </span>
        <span className="text-[13px] text-data tabular-nums">{track.bpm ?? '—'}</span>
        <span className="text-[13px] text-data tabular-nums">{track.key}</span>
        <span
          className={`justify-self-start rounded-full border px-2.5 py-0.5 text-xs ${track.mood ? 'border-control text-data' : track.analysis === 'done' ? 'border-accent text-accent' : 'border-line-strong text-subtle'}`}
        >
          {track.mood ?? (track.analysis === 'done' ? 'À confirmer' : '—')}
        </span>
        <span className="flex gap-[3px]">
          <span className="sr-only">Énergie {track.energy} sur 5</span>
          {[1, 2, 3, 4, 5].map((level) => (
            <span
              key={level}
              aria-hidden="true"
              className={`size-2.5 rounded-[2px] ${level <= track.energy ? 'bg-data' : 'bg-line-strong'}`}
            />
          ))}
        </span>
        <span className="flex gap-0.5">
          <span className="sr-only">{plural(cueCount, 'hot cue', 'hot cues')}</span>
          {track.cues.map((cue, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`size-2 rounded-[2px] ${cue ? 'bg-accent' : 'bg-line-strong'}`}
            />
          ))}
        </span>
        <span className={`flex items-center gap-1.5 text-xs ${state.text}`}>
          <span aria-hidden="true" className={`size-1.5 rounded-full ${state.dot}`} />
          {state.label}
        </span>
        <span className="text-xs text-subtle tabular-nums">{track.duration ? formatTime(track.duration) : '—'}</span>
      </button>
    </div>
  )
}
