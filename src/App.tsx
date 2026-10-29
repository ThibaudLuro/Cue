import { Glow } from './components/Glow'
import { useScrollReveal } from './lib/useScrollReveal'
import { BeforeAfter } from './sections/BeforeAfter'
import { CallToAction } from './sections/CallToAction'
import { Compatibility } from './sections/Compatibility'
import { Faq } from './sections/Faq'
import { Features } from './sections/Features'
import { Footer } from './sections/Footer'
import { Header } from './sections/Header'
import { Hero } from './sections/Hero'
import { HotCues } from './sections/HotCues'
import { HowItWorks } from './sections/HowItWorks'
import { Moods } from './sections/Moods'
import { Pricing } from './sections/Pricing'
import { UsbPreview } from './sections/UsbPreview'

function App() {
  useScrollReveal()

  return (
    // overflow-hidden clips the hero glows, which reach past the page edges.
    <div className="min-h-screen overflow-hidden bg-canvas text-fg">
      <Header />
      <main id="top">
        <div className="relative">
          <Glow
            token="--color-grad-from"
            strength={13.5}
            className="-top-[260px] -left-[200px] size-[720px] motion-safe:animate-glow-in"
          />
          <Glow
            token="--color-grad-via"
            strength={10.5}
            className="top-[120px] -right-[260px] size-[820px] motion-safe:animate-glow-in motion-safe:[animation-delay:300ms]"
          />
          <Hero />
          <UsbPreview />
        </div>
        <BeforeAfter />
        <Features />
        <HotCues />
        <Moods />
        <HowItWorks />
        <Compatibility />
        <Pricing />
        <Faq />
        <CallToAction />
      </main>
      <Footer />
    </div>
  )
}

export default App
