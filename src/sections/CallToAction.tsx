import { Glow } from '../components/Glow'
import { tint } from '../lib/tint'

export function CallToAction() {
  return (
    <section className="relative px-6 pb-28">
      <div
        data-reveal
        className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[28px] border border-line-strong px-14 py-24 max-sm:px-6 max-sm:py-16"
        style={{ background: `linear-gradient(135deg, ${tint('--color-grad-from', 12)} 0%, transparent 55%), var(--color-surface)` }}
      >
        <Glow token="--color-grad-to" strength={10.5} className="-right-[160px] -bottom-[320px] size-[640px]" />
        <div className="relative flex flex-col items-start gap-7">
          <h2 className="max-w-[820px] text-[clamp(40px,6vw,72px)] leading-[1.02] font-semibold tracking-[-0.04em]">
            Préparez votre
            <br />
            <span className="text-gradient-brand">prochaine clé.</span>
          </h2>
          <p className="max-w-[520px] text-lg text-data">
            Branchez-la, Cue s’occupe du rangement et des repères. Sans carte bancaire.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="#essayer"
              className="flex h-12 items-center rounded-lg bg-gradient-brand px-6 text-[15px] font-semibold text-canvas transition hover:opacity-90 active:scale-[0.98]"
            >
              Connecter ma clé
            </a>
            <a
              href="#tarifs"
              className="flex h-12 items-center rounded-lg border border-idle bg-canvas/40 px-6 text-[15px] text-fg transition hover:border-subtle active:scale-[0.98]"
            >
              Voir les tarifs
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
