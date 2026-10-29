import { Section } from '../components/Section'

const groups = [
  { title: 'Logiciels et lecteurs', items: ['rekordbox', 'Engine DJ', 'Lecteurs CDJ et XDJ'] },
  { title: 'Formats audio', items: ['MP3', 'WAV', 'FLAC', 'AIFF'] },
  { title: 'Navigateurs', items: ['Chrome', 'Edge', 'Opera'] },
]

export function Compatibility() {
  return (
    <Section
      id="compatibilite"
      label="Compatibilité"
      revealGroup
      className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-8 py-16"
    >
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-3">
          <h3 className="text-xs tracking-[0.08em] text-subtle uppercase">{group.title}</h3>
          <ul className="flex flex-wrap gap-2">
            {group.items.map((item) => (
              <li key={item} className="rounded-full border border-line-strong px-3 py-1.5 text-[13px] text-data">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Section>
  )
}
