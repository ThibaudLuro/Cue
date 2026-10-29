import type { CSSProperties } from 'react'
import { Dot, MoodChip, Tag } from '../components/ui'
import { folders, trackBars, trackParts, tracks, type Folder } from '../data/demo'
import type { EnergyLevel } from '../lib/waveform'

const barColor: Record<EnergyLevel, string> = {
  high: 'bg-accent',
  mid: 'bg-subtle',
  low: 'bg-wave-lo',
}

const folderIndent = ['pl-2.5', 'pl-5.5', 'pl-9.5']

function folderColor(folder: Folder) {
  if (folder.depth === 0 || folder.selected) return 'text-fg'
  return folder.depth === 1 ? 'text-data' : 'text-muted'
}

const tableColumns = 'grid grid-cols-[minmax(0,1fr)_64px_48px_150px_80px] gap-3'

export function UsbPreview() {
  return (
    <section aria-label="Aperçu d’une clé USB préparée" className="relative mx-auto max-w-[1200px] px-6 pb-32">
      <div data-reveal className="rounded-[20px] bg-gradient-frame p-px [--reveal-delay:250ms]">
        <div className="overflow-hidden rounded-[19px] bg-surface/95">
          <div className="flex flex-wrap items-center gap-4 border-b border-line px-5 py-4 text-[13px] tabular-nums">
            <span>USB · SET_SAMEDI</span>
            <span className="text-subtle">60 morceaux</span>
            <span className="flex items-center gap-2 text-muted">
              <Dot />
              Prête à enregistrer
            </span>
          </div>

          <div className="flex flex-col md:flex-row">
            <ul
              aria-label="Dossiers de la clé"
              className="border-b border-line px-3 py-4 md:w-[260px] md:shrink-0 md:border-r md:border-b-0"
            >
              {folders.map((folder) => (
                <li
                  key={folder.name}
                  className={`flex items-center gap-2 rounded-lg py-[7px] pr-2.5 text-[13px] ${folderIndent[folder.depth]} ${folder.selected ? 'bg-accent/18' : ''}`}
                >
                  <span
                    aria-hidden="true"
                    className={`size-2 shrink-0 rounded-full ${folder.depth === 2 ? 'bg-accent' : 'bg-idle'}`}
                  />
                  <span className={`flex-1 truncate ${folderColor(folder)}`}>{folder.name}</span>
                  <span className="text-[11px] text-subtle tabular-nums">{folder.count}</span>
                </li>
              ))}
            </ul>

            <div className="min-w-0 flex-1 px-6 pt-6 pb-2">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold tracking-[-0.01em]">Concrete Bloom</p>
                  <p className="mt-0.5 text-[13px] text-subtle">Kessler Unit</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Tag>124 BPM</Tag>
                  <Tag>9A</Tag>
                  <MoodChip>Sombre</MoodChip>
                </div>
              </div>

              <div className="relative mt-10 h-28">
                <div data-wave aria-hidden="true" className="absolute inset-0 flex items-center gap-0.5">
                  {trackBars.map((bar, i) => (
                    // Below lg there is not enough room for 150 bars: keep one in two.
                    <span
                      key={i}
                      className={`min-w-px flex-1 rounded-[1px] max-lg:odd:hidden ${barColor[bar.level]}`}
                      style={{ height: `${bar.height * 100}%`, '--i': i } as CSSProperties}
                    />
                  ))}
                </div>
                {trackParts.map((part, i) => (
                  <div
                    key={part.cue}
                    data-cue-marker
                    aria-hidden="true"
                    className="absolute -top-[26px] bottom-0 w-px bg-accent"
                    style={{ left: `${part.start * 100}%`, '--i': i } as CSSProperties}
                  >
                    <span className="absolute top-0 left-0 flex size-[18px] items-center justify-center rounded-sm bg-accent text-[11px] font-semibold text-canvas">
                      {part.cue}
                    </span>
                  </div>
                ))}
              </div>
              <div aria-label="Structure du morceau" className="mt-2 flex border-t border-line-strong">
                {trackParts.map((part) => (
                  <span
                    key={part.cue}
                    className="truncate pt-2 pl-1.5 text-[11px] text-muted"
                    style={{ width: `${(part.end - part.start) * 100}%` }}
                  >
                    {part.label}
                  </span>
                ))}
              </div>

              <div className="mt-6 overflow-x-auto">
                <div role="table" aria-label="Morceaux du dossier" className="min-w-[560px]">
                  <div
                    role="row"
                    className={`${tableColumns} py-2.5 text-xs tracking-[0.06em] text-subtle uppercase`}
                  >
                    <span role="columnheader">Titre</span>
                    <span role="columnheader">BPM</span>
                    <span role="columnheader">Clé</span>
                    <span role="columnheader">Ambiance</span>
                    <span role="columnheader">Hot cues</span>
                  </div>
                  {tracks.map((track, i) => (
                    <div key={track.title} role="row" className={`${tableColumns} items-center border-t border-row py-3`}>
                      <span role="cell" className={`truncate text-sm ${i === 0 ? 'text-fg' : 'text-data'}`}>
                        {track.title}
                      </span>
                      <span role="cell" className="text-[13px] text-data tabular-nums">
                        {track.bpm}
                      </span>
                      <span role="cell" className="text-[13px] text-data tabular-nums">
                        {track.key}
                      </span>
                      <span role="cell" className="flex items-center gap-1.5 text-[13px] text-muted">
                        <Dot />
                        {track.mood}
                      </span>
                      <span role="cell" className="flex gap-[3px]">
                        <span className="sr-only">{track.cues}</span>
                        {Array.from({ length: track.cues }, (_, cue) => (
                          <span key={cue} aria-hidden="true" className="size-2 rounded-[2px] bg-accent" />
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
