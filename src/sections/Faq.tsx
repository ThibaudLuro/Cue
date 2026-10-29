import { Section, SectionTitle } from '../components/Section'

const questions = [
  {
    q: 'Mes morceaux sont-ils envoyés sur internet ?',
    a: 'Non : Cue lit les fichiers directement sur votre clé, rien n’est importé sur le site. L’analyse se fait dans votre navigateur, sur votre ordinateur : vos morceaux ne quittent jamais la clé.',
  },
  {
    q: 'Mes dossiers actuels vont-ils être effacés ?',
    a: 'Rien n’est écrit sur la clé avant que vous cliquiez sur « Enregistrer sur la clé ». Vous voyez le nouveau rangement avant de valider, et Cue garde une copie de votre organisation d’origine pour revenir en arrière à tout moment.',
  },
  {
    q: 'Puis-je corriger une ambiance ou un hot cue ?',
    a: 'Oui. Changez l’ambiance d’un morceau et il change de dossier ; déplacez ou renommez un hot cue directement sur la forme d’onde.',
  },
  {
    q: 'Quels logiciels et lecteurs lisent la clé ?',
    a: 'La clé préparée s’ouvre dans rekordbox et Engine DJ, et se lit directement sur les lecteurs CDJ et XDJ : vos dossiers et vos hot cues sont déjà là.',
  },
  {
    q: 'Quels navigateurs puis-je utiliser ?',
    a: 'Cue a besoin d’accéder à votre clé depuis le navigateur : Chrome, Edge ou Opera, sur ordinateur (Windows, macOS ou Linux).',
  },
  {
    q: 'Quels formats audio sont pris en charge ?',
    a: 'MP3, WAV, FLAC et AIFF.',
  },
]

export function Faq() {
  return (
    <Section id="faq" revealGroup className="flex flex-wrap gap-16 py-28">
      <SectionTitle className="flex-[1_1_280px]">Questions fréquentes</SectionTitle>
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
