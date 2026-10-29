import { Logo } from '../components/ui'

const columns = [
  {
    title: 'Produit',
    links: [
      { href: '#cle-usb', label: 'Fonctionnalités' },
      { href: '#hot-cues', label: 'Hot cues' },
      { href: '#tarifs', label: 'Tarifs' },
    ],
  },
  {
    title: 'Aide',
    links: [
      { href: '#faq', label: 'FAQ' },
      { href: '#compatibilite', label: 'Compatibilité' },
      { href: '#contact', label: 'Contact' },
    ],
  },
  {
    title: 'Légal',
    links: [
      { href: '#confidentialite', label: 'Confidentialité' },
      { href: '#conditions', label: 'Conditions' },
      { href: '#mentions', label: 'Mentions légales' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1200px] flex-wrap gap-12 px-6 pt-16 pb-8">
        <div className="flex flex-[2_1_260px] flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <Logo size="sm" />
            <span className="font-semibold">Cue</span>
          </div>
          <p className="max-w-[280px] text-sm text-subtle">
            Votre clé USB rangée par BPM et par ambiance, avec ses hot cues.
          </p>
        </div>

        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-[1_1_140px] flex-col gap-2.5 text-sm">
            <span className="mb-1 text-xs tracking-[0.08em] text-subtle uppercase">{column.title}</span>
            {column.links.map((link) => (
              <a key={link.href} href={link.href} className="text-data transition-colors hover:text-fg">
                {link.label}
              </a>
            ))}
          </nav>
        ))}
      </div>
      <div className="mx-auto max-w-[1200px] border-t border-line p-6 text-[13px] text-subtle">© 2026 Cue</div>
    </footer>
  )
}
