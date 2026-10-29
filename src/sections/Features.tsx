import { UsbIcon } from '../components/icons'
import { Section, SectionHeader } from '../components/Section'
import { cueStrips } from '../data/demo'
import { tint } from '../lib/tint'
import type { EnergyLevel } from '../lib/waveform'

const features = [
  { label: 'BPM', text: 'Dossiers par plage de tempo, du warm-up au peak time.' },
  { label: 'AMBIANCE', text: 'Sous-dossiers par ambiance musicale : sombre, solaire, énergique…' },
  { label: 'HOT CUES', text: 'Placés automatiquement sur l’intro, les montées, les drops, les breaks et l’outro.' },
]

const benefits = [
  {
    title: 'Lecture directe',
    text: 'Cue travaille sur les morceaux déjà présents sur la clé. Rien à importer, rien à recopier.',
    token: '--color-grad-from',
    dot: 'bg-grad-from',
  },
  {
    title: 'Rangement au choix',
    text: 'Classez par BPM puis par ambiance, ou l’inverse, selon votre façon de jouer.',
    token: '--color-grad-via',
    dot: 'bg-grad-via',
  },
  {
    title: 'Vous gardez la main',
    text: 'Changez l’ambiance d’un morceau ou déplacez un hot cue : la clé est mise à jour.',
    token: '--color-grad-to',
    dot: 'bg-grad-to',
  },
]

const cueColor: Record<EnergyLevel, string> = {
  high: 'bg-accent',
  mid: 'bg-accent/70',
  low: 'bg-accent/45',
}

export function Features() {
  return (
    <Section id="cle-usb" divider={false} className="pt-16 pb-28">
      <SectionHeader
        title={
          <>
            Rangée, repérée,
            <br />
            prête à jouer.
          </>
        }
        intro="Cue prend en charge la partie fastidieuse de la préparation : le tri et les repères. Vous validez chaque choix."
      />

      <article
        data-reveal
        className="mb-4 flex flex-wrap gap-12 rounded-3xl border border-line bg-surface p-10 max-sm:p-6"
      >
        <div className="flex flex-[1_1_360px] flex-col gap-6">
          <span className="flex size-11 items-center justify-center self-start rounded-xl bg-accent text-canvas">
            <UsbIcon />
          </span>
          <div>
            <h3 className="mb-2.5 text-[clamp(26px,3vw,32px)] font-semibold tracking-[-0.02em]">
              Préparation de clé USB
            </h3>
            <p className="max-w-[460px] text-muted">
              De vos fichiers en vrac à une clé rangée et prête à jouer, sans passer des heures dans votre logiciel.
            </p>
          </div>
          <ul className="flex flex-col border-t border-line">
            {features.map((feature) => (
              <li key={feature.label} className="flex gap-4 border-b border-line py-3.5">
                <span className="w-22 shrink-0 pt-0.5 text-xs text-subtle">{feature.label}</span>
                <span className="text-[15px] text-data">{feature.text}</span>
              </li>
            ))}
          </ul>
          <a
            href="#essayer"
            className="flex h-11 items-center self-start rounded-lg bg-accent px-5.5 text-[15px] font-semibold text-canvas transition hover:opacity-90 active:scale-[0.98]"
          >
            Préparer ma clé
          </a>
        </div>

        <div aria-hidden="true" className="flex min-w-0 flex-[1_1_420px] flex-col justify-center gap-3">
          {cueStrips.map((strip) => (
            <div key={strip.title} className="rounded-[14px] border border-line bg-canvas/80 px-4 py-3.5">
              <div className="mb-3 flex justify-between text-[13px]">
                <span className="text-data">{strip.title}</span>
                <span className="text-subtle tabular-nums">{strip.meta}</span>
              </div>
              <div className="flex h-6 gap-[3px]">
                {strip.parts.map((part) => (
                  <span
                    key={part.cue}
                    className={`relative rounded-sm ${cueColor[part.level]}`}
                    style={{ width: `${part.width}%` }}
                  >
                    <span className="absolute top-1 left-[5px] text-[10px] font-semibold text-canvas">{part.cue}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </article>

      <div data-reveal-group className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
        {benefits.map((benefit) => (
          <div
            key={benefit.title}
            className="flex flex-col gap-3 rounded-[20px] border border-line p-7"
            style={{ background: `radial-gradient(circle at 0% 0%, ${tint(benefit.token, 5)} 0%, transparent 55%)` }}
          >
            <span aria-hidden="true" className={`size-2.5 rounded-full ${benefit.dot}`} />
            <h3 className="text-lg font-semibold">{benefit.title}</h3>
            <p className="text-[15px] text-muted">{benefit.text}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}
