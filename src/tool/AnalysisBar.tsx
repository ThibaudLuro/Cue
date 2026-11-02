import { Spinner } from '../components/ui'
import { plural } from './model'
import type { KeyPrep } from './useKeyPrep'

// While Cue analyses the key: what it is doing, on which track, and how far it got.
export function AnalysisBar({ prep }: { prep: KeyPrep }) {
  const { analysis } = prep
  if (!analysis.running && !analysis.download) return null

  const download = analysis.download
  // Before the first track: the model is being fetched (known size) or set up (unknown).
  const preparing = !analysis.current
  const percent = download
    ? (download.loaded / download.total) * 100
    : analysis.total
      ? (analysis.done / analysis.total) * 100
      : 0
  const track = prep.tracks.find((t) => t.id === analysis.current)
  const left = analysis.total - analysis.done

  return (
    <div role="status" className="border-b border-line bg-surface">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2 text-[13px]">
        <Spinner className="size-4 text-accent" />
        <span className="font-medium text-fg">
          {download
            ? `Downloading the analysis model · ${Math.round(percent)}%`
            : preparing
              ? 'Preparing analysis…'
              : `Analysing tracks · ${analysis.done} of ${analysis.total}`}
        </span>
        {track && (
          <span className="min-w-0 truncate text-muted">
            Now: {track.artist} – {track.title}
          </span>
        )}
        <span className="ml-auto text-xs text-subtle">
          {download
            ? 'Only once: the browser keeps it afterwards'
            : `${plural(left, 'track left', 'tracks left')} · you can keep working`}
        </span>
      </div>
      <div aria-hidden="true" className="h-[3px] overflow-hidden bg-line">
        {preparing && !download ? (
          <div className="h-full w-2/5 bg-accent motion-safe:animate-indeterminate" />
        ) : (
          <div className="h-full bg-accent transition-[width] duration-500 ease-fluid" style={{ width: `${percent}%` }} />
        )}
      </div>
    </div>
  )
}
