import { Section, SectionHeader } from '../components/Section'
import { tint } from '../lib/tint'
import { levelBars } from '../lib/waveform'

const moods = [
  { name: '1 · Low', text: 'Calm, little or no kick: for opening up or a breather.', energy: 0.3 },
  { name: '2 · Warm-up', text: 'Smooth, laid-back groove, perfect for the warm-up.', energy: 0.45 },
  { name: '3 · Groove', text: 'Solid, danceable rhythm: the heart of the set.', energy: 0.65 },
  { name: '4 · Build', text: 'Pushing harder: heavy bass, rising tension.', energy: 0.82 },
  { name: '5 · Peak', text: 'Powerful and punchy, for the peak moment.', energy: 1 },
].map((mood, i) => ({ ...mood, bars: levelBars(24, mood.energy, (i + 1) * 9.17) }))

export function Moods() {
  return (
    <Section id="ambiances" className="py-28">
      <SectionHeader
        title={
          <>
            Sorted by ear,
            <br />
            not just by tempo.
          </>
        }
        intro="Two tracks at 124 BPM don’t belong at the same point in the night. Cue also sorts by energy level, from warm-up to peak time."
      />

      <ul data-reveal-group className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
        {moods.map((mood) => (
          <li
            key={mood.name}
            className="flex flex-col gap-4 rounded-[18px] border border-line p-5"
            // The higher the energy, the stronger the corner glow.
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
