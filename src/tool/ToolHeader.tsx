import { useState } from 'react'
import { Link } from 'react-router'
import { DownloadIcon } from '../components/icons'
import { Dot, Logo, Spinner } from '../components/ui'
import { AnalysisBar } from './AnalysisBar'
import { SaveHelp } from './SaveHelp'
import { plural } from './model'
import type { KeyPrep } from './useKeyPrep'

function statusLabel(prep: KeyPrep) {
  if (prep.key.phase === 'unplugged') return 'Stick unplugged'
  if (prep.key.scanning) return 'Reading the stick'
  if (prep.status === 'saving') return 'Writing'
  if (prep.status === 'saved') return 'Up to date'
  const { analysis } = prep
  if (analysis.download) {
    const percent = Math.round((analysis.download.loaded / analysis.download.total) * 100)
    return `Preparing analysis ${percent}%`
  }
  if (analysis.running) return `Analysing ${analysis.done}/${analysis.total}`
  return analysis.error ? 'Partial analysis' : 'Analysis done'
}

function saveLabel(prep: KeyPrep) {
  if (prep.status === 'saving') return `Saving… ${prep.progress}%`
  if (prep.status === 'saved') return 'Export saved'
  return 'Save to the stick'
}

export function ToolHeader({ prep }: { prep: KeyPrep }) {
  const saving = prep.status === 'saving'
  const [helpOpen, setHelpOpen] = useState(false)
  const busy = prep.key.scanning || prep.analysis.running || Boolean(prep.analysis.download)

  return (
    <>
      <header className="flex min-h-[60px] flex-wrap items-center gap-4 border-b border-line px-5 py-2.5">
        <Link to="/" aria-label="Cue, home" className="flex items-center gap-2 text-fg">
          <Logo size="md" />
          <span className="text-base font-semibold tracking-[-0.02em]">Cue</span>
        </Link>
        <span aria-hidden="true" className="h-5 w-px bg-line-strong" />
        <div className="flex items-center gap-2.5 text-[13px]">
          <span
            title={prep.analysis.error ?? undefined}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-xs tabular-nums ${busy ? 'border-accent text-fg' : 'border-line-strong text-data'}`}
          >
            {busy ? <Spinner className="size-3 text-accent" /> : <Dot />}
            {statusLabel(prep)}
          </span>
        </div>

        <div className="flex-1" />

        {prep.status !== 'saved' && (
          <span className="text-[13px] text-muted">
            {plural(prep.sortedCount, 'track', 'tracks')} · {prep.cuesToWrite} hot cues to write
          </span>
        )}
        <button
          type="button"
          onClick={prep.save}
          disabled={prep.key.phase !== 'ready'}
          className={`relative flex h-10 min-w-[200px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-lg px-[18px] text-sm font-semibold text-canvas transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${prep.status === 'saved' ? 'bg-data' : 'bg-accent hover:opacity-90'}`}
        >
          {/* Lighter veil over the part still to write: the button fills up from left to right. */}
          {saving && (
            <span
              aria-hidden="true"
              className="absolute inset-y-0 right-0 bg-white/35 transition-[width] duration-100"
              style={{ width: `${100 - prep.progress}%` }}
            />
          )}
          <DownloadIcon width={16} height={16} className="relative" />
          <span className="relative tabular-nums">{saveLabel(prep)}</span>
        </button>
        <SaveHelp prep={prep} open={helpOpen} onOpenChange={setHelpOpen} />
        <button
          type="button"
          aria-label="My account"
          className="size-9 cursor-pointer rounded-full border border-control bg-surface text-xs font-semibold text-data transition hover:border-subtle"
        >
          DJ
        </button>
      </header>

      <AnalysisBar prep={prep} />
      {prep.analysis.error && (
        <p role="alert" className="border-b border-line bg-surface px-5 py-2.5 text-[13px] text-accent">
          {prep.analysis.error}
        </p>
      )}
      {prep.saveError && (
        <p role="alert" className="border-b border-line bg-surface px-5 py-2.5 text-[13px] text-accent">
          {prep.saveError}
        </p>
      )}
      <div role="status">
        {prep.toast && (
          <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-5 py-2.5 text-[13px] motion-safe:animate-rise">
            <span
              aria-hidden="true"
              className="flex size-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-canvas"
            >
              ✓
            </span>
            <span className="flex-1">
              <span className="font-medium">CUE/rekordbox.xml</span> saved on {prep.key.name}. Import it in rekordbox to
              get your grid and hot cues, then export to the stick for the CDJs.
            </span>
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="h-8 cursor-pointer rounded-lg px-3 text-[13px] text-accent transition-opacity hover:opacity-80"
            >
              How?
            </button>
            <button
              type="button"
              onClick={prep.closeToast}
              className="h-8 cursor-pointer rounded-lg border border-control px-3 text-[13px] text-fg transition hover:border-subtle"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </>
  )
}
