import { Section, SectionHeader } from '../components/Section'

type Plan = {
  name: string
  tagline: string
  price: string
  period?: string
  features: string[]
  cta: string
  featured?: boolean
}

const plans: Plan[] = [
  {
    name: 'Starter',
    tagline: 'To try it on one stick.',
    price: '0 €',
    features: ['50 tracks per month', 'Sorting by BPM and energy level', 'Automatic hot cues'],
    cta: 'Get started',
  },
  {
    name: 'DJ',
    tagline: 'To prep every set.',
    price: '7 €',
    period: '/ month',
    features: [
      'Unlimited tracks',
      'Choose your sort order',
      'Editable energy levels and hot cues',
      'Multiple sticks',
    ],
    cta: 'Choose DJ',
    featured: true,
  },
  {
    name: 'Resident',
    tagline: 'The DJ plan, billed yearly.',
    price: '70 €',
    period: '/ year',
    features: ['Everything in the DJ plan', '2 months free'],
    cta: 'Choose Resident',
  },
]

export function Pricing() {
  return (
    <Section id="tarifs" className="py-28">
      <SectionHeader
        title="Pricing"
        intro="Start free, then upgrade as your library grows."
      />

      <div data-reveal-group className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
        {plans.map((plan) =>
          plan.featured ? (
            // The featured plan gets a 1px accent frame instead of a plain border.
            <div key={plan.name} className="rounded-[20px] bg-accent/50 p-px">
              <PlanCard plan={plan} className="h-full rounded-[19px] bg-surface" />
            </div>
          ) : (
            <PlanCard key={plan.name} plan={plan} className="rounded-[20px] border border-line" />
          ),
        )}
      </div>
    </Section>
  )
}

function PlanCard({ plan, className }: { plan: Plan; className: string }) {
  return (
    <article className={`flex flex-col gap-6 p-8 ${className}`}>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{plan.name}</h3>
          {plan.featured && (
            <span className="rounded-full bg-accent px-2.5 py-[3px] text-xs font-semibold text-canvas">
              Recommended
            </span>
          )}
        </div>
        <p className="text-sm text-muted">{plan.tagline}</p>
      </div>

      <p className="flex items-baseline gap-1.5">
        <span className="text-[40px] font-semibold tracking-[-0.03em]">{plan.price}</span>
        {plan.period && <span className="text-sm text-subtle">{plan.period}</span>}
      </p>

      <ul className="flex flex-col gap-2.5 text-sm text-data">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2.5">
            <span aria-hidden="true" className="text-accent">
              ✓
            </span>
            {feature}
          </li>
        ))}
      </ul>

      <a
        href="#essayer"
        className={
          plan.featured
            ? 'mt-auto flex h-11 items-center justify-center rounded-lg bg-accent text-[15px] font-semibold text-canvas transition hover:opacity-90 active:scale-[0.98]'
            : 'mt-auto flex h-11 items-center justify-center rounded-lg border border-control text-[15px] text-fg transition hover:border-subtle active:scale-[0.98]'
        }
      >
        {plan.cta}
      </a>
    </article>
  )
}
