import { Section, SectionTitle } from '../components/Section'
import { trackParts } from '../data/demo'
import { energyLevel, type EnergyLevel } from '../lib/waveform'

const cueGuide = [
  { cue: 'A', label: 'Intro', use: 'Your way in to start the mix.' },
  { cue: 'B', label: 'Build-up', use: 'Where the tension starts.' },
  { cue: 'C', label: 'Drop', use: 'The big moment, ready to land on the beat.' },
  { cue: 'D', label: 'Break', use: 'A breather, or a spot to bring in the next tune.' },
  { cue: 'E', label: 'Drop 2', use: 'The second big moment.' },
  { cue: 'F', label: 'Outro', use: 'Your way out into the next track.' },
]

const segmentColor: Record<EnergyLevel, string> = {
  high: 'bg-accent',
  mid: 'bg-accent/70',
  low: 'bg-accent/45',
}

// Eight pads like a controller, lit for each cue the track uses.
const pads = Array.from({ length: 8 }, (_, i) => i < trackParts.length)

export function HotCues() {
  return (
    <Section id="hot-cues" revealGroup className="flex flex-wrap items-start gap-16 py-28">
      <div className="flex flex-[1_1_360px] flex-col gap-5">
        <span className="text-xs tracking-[0.08em] text-accent uppercase">Hot cues</span>
        <SectionTitle>A cue on every section that matters.</SectionTitle>
        <p className="max-w-[440px] text-muted">
          Cue maps out each track’s structure and drops a hot cue at the start of every section. Up to eight per
          track, like the pads on your controller, each with its own color.
        </p>
        <p className="max-w-[440px] text-muted">Cue in the wrong spot? Move it or rename it, and the stick follows.</p>
      </div>

      <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-6">
        <div aria-hidden="true" className="rounded-[20px] border border-line bg-surface p-6">
          <div className="mb-4 flex justify-between text-[13px]">
            <span>Concrete Bloom</span>
            <span className="text-subtle tabular-nums">124 BPM · 9A · 6:52</span>
          </div>
          <div className="flex h-11 gap-[3px]">
            {trackParts.map((part) => (
              <span
                key={part.cue}
                className={`relative rounded-md ${segmentColor[energyLevel(part.energy)]}`}
                style={{ width: `${(part.end - part.start) * 100}%` }}
              >
                <span className="absolute top-1.5 left-[7px] text-[11px] font-semibold text-canvas">{part.cue}</span>
              </span>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-8 gap-1.5">
            {pads.map((lit, i) => (
              <span
                key={i}
                className={`aspect-square rounded-lg border ${lit ? 'border-accent bg-accent/90' : 'border-control'}`}
              />
            ))}
          </div>
        </div>

        <ul className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-6">
          {cueGuide.map((item) => (
            <li key={item.cue} className="flex gap-3.5 border-t border-line py-3.5">
              <span className="flex size-[22px] shrink-0 items-center justify-center rounded-md bg-accent text-xs font-semibold text-canvas">
                {item.cue}
              </span>
              <span className="flex flex-col">
                <span className="text-[15px] font-medium">{item.label}</span>
                <span className="text-[13px] text-muted">{item.use}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}
