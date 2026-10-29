import { Section, SectionHeader } from '../components/Section'
import { messyFiles, tidyFolders } from '../data/demo'

const tidyIndent = ['pl-2.5', 'pl-6', 'pl-10']
const tidyColor = ['text-fg', 'text-data', 'text-muted']
const tidyDot = ['bg-idle', 'bg-accent', 'bg-transparent']

export function BeforeAfter() {
  return (
    <Section id="avant-apres" divider={false} className="py-28">
      <SectionHeader
        title={
          <>
            Du dossier en vrac
            <br />à la clé rangée.
          </>
        }
        intro="Noms de fichiers incohérents, téléchargements empilés, aucun repère : Cue remet de l’ordre sans rien supprimer."
      />

      <div data-reveal-group className="flex flex-col gap-4 md:flex-row">
        <div className="flex min-w-0 flex-col gap-4 rounded-[20px] border border-dashed border-line-strong p-6 md:flex-1">
          <h3 className="text-xs tracking-[0.08em] text-subtle uppercase">Avant</h3>
          <ul className="flex flex-col gap-0.5">
            {messyFiles.map((file) => (
              <li key={file} className="flex items-center gap-2.5 px-2.5 py-2 text-[13px] text-subtle">
                <span aria-hidden="true" className="h-2.5 w-2 shrink-0 rounded-xs border border-idle" />
                <span className="truncate">{file}</span>
              </li>
            ))}
          </ul>
        </div>

        <div aria-hidden="true" className="flex items-center justify-center px-2">
          <span className="flex size-11 items-center justify-center rounded-full bg-accent text-xl font-semibold text-canvas max-md:rotate-90">
            →
          </span>
        </div>

        <div className="min-w-0 rounded-[20px] bg-gradient-frame p-px md:flex-1">
          <div className="flex h-full flex-col gap-4 rounded-[19px] bg-surface p-6">
            <h3 className="text-xs tracking-[0.08em] text-accent uppercase">Après</h3>
            <ul className="flex flex-col gap-0.5">
              {tidyFolders.map((folder) => (
                <li
                  key={folder.name}
                  className={`flex items-center gap-2.5 py-2 pr-2.5 text-[13px] ${tidyIndent[folder.depth]}`}
                >
                  <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${tidyDot[folder.depth]}`} />
                  <span className={`flex-1 truncate ${tidyColor[folder.depth]}`}>{folder.name}</span>
                  <span className="text-xs text-subtle tabular-nums">{folder.meta}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Section>
  )
}
