import { Section, SectionTitle } from '../components/Section'

const steps = [
  {
    title: 'Plug in your stick',
    text: 'Cue reads the tracks already on it. Nothing to import.',
    color: 'bg-grad-from',
  },
  {
    title: 'Cue analyzes',
    text: 'Tempo, key, energy level and structure of every track. Adjust the sorting if you need to.',
    color: 'bg-grad-via',
  },
  {
    title: 'Save to the stick',
    text: 'Sorted folders and hot cues written straight to the stick. Unplug and play.',
    color: 'bg-grad-to',
  },
]

export function HowItWorks() {
  return (
    <Section id="fonctionnement" className="py-28">
      <div data-reveal>
        <SectionTitle className="mb-14">How it works</SectionTitle>
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
