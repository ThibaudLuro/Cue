import { Section, SectionHeader } from '../components/Section'
import { tint } from '../lib/tint'
import { levelBars } from '../lib/waveform'

const moods = [
  { name: 'Nocturne', text: 'Profond et feutré, pour ouvrir la nuit.', energy: 0.35 },
  { name: 'Aérien', text: 'Léger, espacé, beaucoup d’air.', energy: 0.4 },
  { name: 'Mélodique', text: 'Porté par les nappes et les mélodies.', energy: 0.55 },
  { name: 'Solaire', text: 'Chaleureux, groovy, lumineux.', energy: 0.65 },
  { name: 'Hypnotique', text: 'Répétitif et progressif, installe la transe.', energy: 0.7 },
  { name: 'Sombre', text: 'Tendu, minimal, basses appuyées.', energy: 0.8 },
  { name: 'Énergique', text: 'Percutant, taillé pour le peak time.', energy: 1 },
].map((mood, i) => ({ ...mood, bars: levelBars(24, mood.energy, (i + 1) * 9.17) }))

export function Moods() {
  return (
    <Section id="ambiances" className="py-28">
      <SectionHeader
        title={
          <>
            Classées à l’oreille,
            <br />
            pas seulement au tempo.
          </>
        }
        intro="Deux morceaux à 124 BPM ne se jouent pas au même moment de la nuit. Cue range aussi par ambiance."
      />

      <ul data-reveal-group className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
        {moods.map((mood) => (
          <li
            key={mood.name}
            className="flex flex-col gap-4 rounded-[18px] border border-line p-5"
            // The more energetic the mood, the stronger the corner glow.
            style={{
              background: `radial-gradient(circle at 100% 0%, ${tint('--color-accent', 3 + 6 * mood.energy)} 0%, transparent 60%), var(--color-card)`,
            }}
          >
            <div aria-hidden="true" className="flex h-7 items-end gap-0.5">
              {mood.bars.map((bar, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-[1px] bg-accent"
                  style={{ height: `${bar.height * 100}%`, opacity: bar.opacity }}
                />
              ))}
            </div>
            <div>
              <h3 className="mb-1 flex items-center gap-2 font-semibold">
                <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
                {mood.name}
              </h3>
              <p className="text-sm text-muted">{mood.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  )
}
