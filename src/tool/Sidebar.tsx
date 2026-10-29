import { Fragment } from 'react'
import { FolderIcon, RefreshIcon, UsbIcon } from '../components/icons'
import { Dot } from '../components/ui'
import { KEY_NAME, UNSORTED, type Grouping } from './model'
import { Overline } from './Overline'
import type { KeyPrep } from './useKeyPrep'

const groupings: { value: Grouping; label: string }[] = [
  { value: 'bpm', label: 'BPM › Ambiance' },
  { value: 'mood', label: 'Ambiance › BPM' },
]

export function Sidebar({ prep }: { prep: KeyPrep }) {
  return (
    <aside
      aria-label="Clé et dossiers"
      className="flex w-full flex-col gap-[22px] border-b border-line bg-canvas/80 p-4 md:w-[260px] md:shrink-0 md:border-r md:border-b-0"
    >
      <KeyCard />

      <div className="flex flex-col gap-2">
        <Overline id="grouping-label">Rangement</Overline>
        <div
          role="group"
          aria-labelledby="grouping-label"
          className="grid grid-cols-2 gap-0.5 rounded-lg border border-line p-[3px]"
        >
          {groupings.map((option) => {
            const on = option.value === prep.grouping
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={on}
                onClick={() => prep.changeGrouping(option.value)}
                className={`h-8 cursor-pointer rounded-md text-xs transition-colors ${on ? 'bg-line text-fg' : 'text-subtle hover:text-data'}`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      <nav aria-label="Dossiers" className="flex flex-1 flex-col gap-0.5">
        <Overline className="mb-1.5">Dossiers</Overline>
        {prep.tree.map((group) => (
          <Fragment key={group.label}>
            <div className="flex items-center gap-2 px-2 pt-2.5 pb-1 text-[13px] text-data">
              <FolderIcon width={14} height={14} className="text-subtle" />
              <span className="flex-1 font-medium">{group.label}</span>
              <span className="text-[11px] text-subtle tabular-nums">{group.count}</span>
            </div>
            {group.folders.map((folder) => {
              const current = !prep.isSearching && folder.id === prep.folder
              const dot = folder.id === UNSORTED ? 'bg-fg' : current ? 'bg-accent' : 'bg-idle'
              return (
                <button
                  key={folder.id}
                  type="button"
                  aria-current={current ? 'true' : undefined}
                  onClick={() => prep.openFolder(folder.id)}
                  className={`flex min-h-[34px] w-full cursor-pointer items-center gap-2 rounded-md pr-2 pl-[30px] text-left text-[13px] transition-colors ${current ? 'bg-line text-fg' : 'text-muted hover:text-fg'}`}
                >
                  <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${dot}`} />
                  <span className="flex-1">{folder.label}</span>
                  <span className="text-[11px] text-subtle tabular-nums">{folder.count}</span>
                </button>
              )
            })}
          </Fragment>
        ))}
      </nav>

      <PendingSummary prep={prep} />

      <button
        type="button"
        onClick={prep.reread}
        disabled={prep.rereading}
        className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-control text-[13px] text-fg transition hover:border-subtle disabled:cursor-wait disabled:opacity-60"
      >
        <RefreshIcon width={16} height={16} className={prep.rereading ? 'motion-safe:animate-spin' : ''} />
        {prep.rereading ? 'Lecture…' : 'Relire la clé'}
      </button>
    </aside>
  )
}

function KeyCard() {
  return (
    <div className="rounded-xl border border-line bg-surface p-3.5">
      <div className="flex items-center gap-2.5">
        <UsbIcon width={18} height={18} className="text-data" />
        <span className="flex-1 font-medium">{KEY_NAME}</span>
        <span className="text-xs text-subtle tabular-nums">32 Go</span>
      </div>
      <div aria-hidden="true" className="mt-3 h-1 overflow-hidden rounded-xs bg-line-strong">
        <div className="h-full w-[23%] bg-data" />
      </div>
      <p className="mt-2 text-xs text-subtle tabular-nums">7,4 Go utilisés · 24,6 Go libres</p>
      <p className="mt-2.5 flex items-center gap-1.5 text-xs text-data">
        <Dot />
        Connectée · lecture directe
      </p>
    </div>
  )
}

function PendingSummary({ prep }: { prep: KeyPrep }) {
  const saved = prep.status === 'saved'
  const rows = saved
    ? [
        { label: 'Morceaux rangés', value: prep.sortedCount },
        { label: 'Hot cues écrits', value: prep.cuesToWrite },
        { label: 'À confirmer', value: prep.unsortedCount, flag: true },
      ]
    : [
        { label: 'Morceaux à ranger', value: prep.sortedCount },
        { label: 'Hot cues à écrire', value: prep.cuesToWrite },
        { label: 'Ambiances à confirmer', value: prep.unsortedCount, flag: true },
      ]

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-3.5">
      <Overline>{saved ? 'Clé à jour' : 'À enregistrer'}</Overline>
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between text-[13px]">
          <span className="text-muted">{row.label}</span>
          <span
            className={`tabular-nums ${row.flag && row.value > 0 ? 'text-accent' : saved ? 'text-data' : 'text-fg'}`}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}
