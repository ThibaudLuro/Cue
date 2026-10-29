import { UsbIcon } from '../components/icons'
import { Dot } from '../components/ui'

export function Hero() {
  return (
    <section className="relative mx-auto max-w-[1200px] px-6 pt-28 pb-16">
      <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface/80 py-1.5 pr-3.5 pl-3 text-[13px] text-data motion-safe:animate-rise">
        <Dot />
        Préparation de clé USB pour DJs
      </p>

      <h1 className="max-w-[960px] text-[clamp(44px,7vw,88px)] leading-[1.02] font-semibold tracking-[-0.04em] motion-safe:animate-rise motion-safe:[animation-delay:80ms]">
        Votre clé USB,
        <br />
        <span className="text-gradient-brand">prête à jouer.</span>
      </h1>

      <p className="mt-7 max-w-[600px] text-lg leading-[1.6] text-muted motion-safe:animate-rise motion-safe:[animation-delay:160ms]">
        Branchez votre clé : Cue lit les morceaux directement dessus, les range par BPM et par ambiance, et place les
        hot cues sur chaque partie. Aucun fichier à importer.
      </p>

      <div id="essayer" className="mt-10 max-w-[640px] motion-safe:animate-rise motion-safe:[animation-delay:240ms]">
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line-strong bg-surface/90 py-3 pr-3 pl-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-line text-fg">
            <UsbIcon />
          </span>
          <div className="flex flex-[1_1_240px] flex-col">
            <span className="text-[15px] font-medium">Branchez votre clé USB</span>
            <span className="text-[13px] text-muted">Cue la lit sur place, vos morceaux ne quittent pas la clé.</span>
          </div>
          <button
            type="button"
            className="h-11 cursor-pointer rounded-lg bg-gradient-brand px-5.5 text-[15px] font-semibold text-canvas transition hover:opacity-90 active:scale-[0.98]"
          >
            Connecter ma clé
          </button>
        </div>
        <p className="mt-3 text-xs text-subtle tabular-nums">MP3 · WAV · FLAC · AIFF · Chrome, Edge et Opera</p>
      </div>
    </section>
  )
}
