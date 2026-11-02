import { Section, SectionTitle } from '../components/Section'

const questions = [
  {
    q: 'Are my tracks uploaded anywhere?',
    a: 'No. Cue reads the files straight from your stick, and nothing is uploaded to the site. Analysis runs in your browser, on your computer: your tracks never leave the stick.',
  },
  {
    q: 'Will my current folders be erased?',
    a: 'Nothing is written to the stick until you click “Save to the stick”. You see the new layout before confirming, and Cue keeps a copy of your original setup so you can roll back at any time.',
  },
  {
    q: 'Can I fix an energy level or a hot cue?',
    a: 'Yes. Change a track’s energy level and it moves to the matching folder; move or rename a hot cue right on the waveform.',
  },
  {
    q: 'Which software and players can read the stick?',
    a: 'The prepped stick opens in rekordbox and Engine DJ, and plays straight on CDJ and XDJ players: your folders and hot cues are already there.',
  },
  {
    q: 'Which browsers can I use?',
    a: 'Cue needs to access your stick from the browser: Chrome, Edge or Opera, on desktop (Windows, macOS or Linux).',
  },
  {
    q: 'Which audio formats are supported?',
    a: 'MP3, WAV, FLAC and AIFF.',
  },
]

export function Faq() {
  return (
    <Section id="faq" revealGroup className="flex flex-wrap gap-16 py-28">
      <SectionTitle className="flex-[1_1_280px]">Frequently asked questions</SectionTitle>
      <div className="min-w-0 flex-[999_1_560px] border-t border-line-strong">
        {questions.map((item) => (
          <details key={item.q} className="group border-b border-line-strong">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[17px] font-medium [&::-webkit-details-marker]:hidden">
              {item.q}
              <span aria-hidden="true" className="text-xl text-subtle transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mb-6 max-w-[640px] text-[15px] leading-[1.6] text-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </Section>
  )
}
