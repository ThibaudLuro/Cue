import { Section, SectionTitle } from '../components/Section'

const steps = [
  {
    title: 'Branchez votre clé',
    text: 'Cue lit les morceaux déjà présents dessus. Rien à importer.',
    color: 'bg-grad-from',
  },
  {
    title: 'Cue analyse',
    text: 'Tempo, tonalité, ambiance et structure de chaque morceau. Vous ajustez le classement si besoin.',
    color: 'bg-grad-via',
  },
  {
    title: 'Enregistrez sur la clé',
    text: 'Dossiers rangés et hot cues écrits directement sur la clé. Débranchez et jouez.',
    color: 'bg-grad-to',
  },
]

export function HowItWorks() {
  return (
    <Section id="fonctionnement" className="py-28">
      <div data-reveal>
        <SectionTitle className="mb-14">Comment ça marche</SectionTitle>
        <div aria-hidden="true" className="mb-7 h-px bg-line-strong" />
      </div>
      <ol data-reveal-group className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-8">
        {steps.map((step, i) => (
          <li key={step.title}>
            <span
              className={`inline-flex size-8 items-center justify-center rounded-full text-[13px] font-semibold text-canvas ${step.color}`}
            >
              {i + 1}
            </span>
            <h3 className="mt-4 mb-2 text-xl font-semibold">{step.title}</h3>
            <p className="text-[15px] text-muted">{step.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}
