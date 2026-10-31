import { Fragment } from 'react'
import { FolderIcon, RefreshIcon, UsbIcon } from '../components/icons'
import { Dot } from '../components/ui'
import { formatBytes, plural, UNSORTED, type Grouping } from './model'
import { Overline } from './Overline'
import type { KeyPrep } from './useKeyPrep'

const groupings: { value: Grouping; label: string }[] = [
  { value: 'bpm', label: 'BPM › Ambiance' },
  { value: 'mood', label: 'Ambiance › BPM' },
]

export function Sidebar({ prep }: { prep: KeyPrep }) {
  const { key } = prep

  return (
    <aside
      aria-label="Clé et dossiers"
      className="flex w-full flex-col border-b border-line bg-canvas/80 md:w-[260px] md:shrink-0 md:border-r md:border-b-0"
    >
      <div className="flex flex-col gap-[22px] p-4 md:min-h-0 md:flex-1 md:overflow-y-auto">
        <KeyCard prep={prep} />

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

      </div>

      {/* Always in view: what is left to save, and re-reading the key. */}
      <div className="flex shrink-0 flex-col gap-3 border-t border-line p-4">
        <PendingSummary prep={prep} />

        <button
          type="button"
          onClick={key.rescan}
          disabled={key.scanning || key.phase !== 'ready'}
          className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-control text-[13px] text-fg transition hover:border-subtle disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshIcon width={16} height={16} className={key.scanning ? 'motion-safe:animate-spin' : ''} />
          {key.scanning ? 'Lecture…' : 'Relire la clé'}
        </button>
      </div>
    </aside>
  )
}

function KeyCard({ prep }: { prep: KeyPrep }) {
  const keyState = prep.key
  const files = keyState.files ?? []
  const size = files.reduce((sum, file) => sum + file.size, 0)
  const plugged = keyState.phase === 'ready'

  return (
    <div className="rounded-xl border border-line bg-surface p-3.5">
      <div className="flex items-center gap-2.5">
        <UsbIcon width={18} height={18} className={plugged ? 'text-data' : 'text-subtle'} />
        <span className="min-w-0 flex-1 truncate font-medium">{keyState.name}</span>
      </div>
      <p className="mt-2 text-xs text-subtle tabular-nums">
        {plural(files.length, 'morceau', 'morceaux')} · {formatBytes(size)}
      </p>
      {plugged ? (
        <p className="mt-2.5 flex items-center gap-1.5 text-xs text-data">
          <Dot />
          Connectée · lecture directe
        </p>
      ) : (
        <p className="mt-2.5 flex items-center gap-1.5 text-xs text-accent">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
          Débranchée · rebranchez-la pour continuer
        </p>
      )}
      <KeyLocation prep={prep} />
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

const DRIVE_LETTERS = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']

// rekordbox needs the key's place on this computer. Worked out on its own in nearly every
// case: only when it cannot be does the DJ pick it, in one click on Windows.
function KeyLocation({ prep }: { prep: KeyPrep }) {
  if (prep.location) {
    return (
      <p className="mt-2 truncate text-xs text-subtle" title="Où rekordbox trouvera les morceaux">
        rekordbox : <span className="text-data tabular-nums">{prep.location}</span>
      </p>
    )
  }

  if (/Windows/.test(navigator.userAgent)) {
    return (
      <div className="mt-3 flex flex-col gap-1.5 text-xs text-subtle">
        <span id="drive-label">Lettre de la clé dans l’Explorateur :</span>
        <div role="group" aria-labelledby="drive-label" className="flex flex-wrap gap-1">
          {DRIVE_LETTERS.map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => prep.key.setLocation(`${letter}:/`)}
              className="h-7 min-w-8 cursor-pointer rounded-md border border-line-strong px-1.5 text-xs text-fg transition-colors hover:border-subtle"
            >
              {letter}:
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <label className="mt-3 flex flex-col gap-1 text-xs text-subtle">
      Dossier de la clé sur cet ordinateur
      <input
        type="text"
        onBlur={(event) => prep.key.setLocation(event.target.value.trim())}
        placeholder="/media/moi/MA_CLE/"
        spellCheck={false}
        className="h-8 rounded-md border border-accent bg-canvas px-2 text-[13px] text-fg outline-none focus:border-accent"
      />
    </label>
  )
}
