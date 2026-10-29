import { useEffect } from 'react'

// Adds data-revealed to [data-reveal] and [data-reveal-group] elements the first time they scroll into view.
// The animations themselves live in index.css.
export function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.setAttribute('data-revealed', '')
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    )

    for (const element of document.querySelectorAll('[data-reveal], [data-reveal-group]')) {
      observer.observe(element)
    }
    return () => observer.disconnect()
  }, [])
}
