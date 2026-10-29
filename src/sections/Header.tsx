import { Logo } from '../components/ui'

const links = [
  { href: '#cle-usb', label: 'Fonctionnalités' },
  { href: '#hot-cues', label: 'Hot cues' },
  { href: '#tarifs', label: 'Tarifs' },
  { href: '#faq', label: 'FAQ' },
]

export function Header() {
  return (
    <header className="relative z-[2] border-b border-line">
      <nav
        aria-label="Navigation principale"
        className="mx-auto flex min-h-18 max-w-[1200px] flex-wrap items-center justify-between gap-x-4 gap-y-3 px-6 py-4 lg:py-0"
      >
        <a href="#top" className="flex items-center gap-2.5 text-fg">
          <Logo />
          <span className="text-lg font-semibold tracking-[-0.02em]">Cue</span>
        </a>

        {/* Below lg the links drop to their own row under the logo and buttons. */}
        <div className="order-last flex w-full flex-wrap gap-x-7 gap-y-2 text-sm lg:order-none lg:w-auto">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="text-muted transition-colors hover:text-fg">
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a
            href="#connexion"
            className="hidden h-10 items-center rounded-lg px-3.5 text-sm text-fg transition-colors hover:text-accent sm:flex"
          >
            Se connecter
          </a>
          <a
            href="#essayer"
            className="flex h-10 items-center rounded-lg bg-fg px-4 text-sm font-medium text-canvas transition hover:bg-data active:scale-[0.98]"
          >
            Essayer gratuitement
          </a>
        </div>
      </nav>
    </header>
  )
}
