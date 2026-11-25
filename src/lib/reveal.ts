/**
 * Minimal scroll so an element is fully visible between the fixed overlays:
 * elements marked data-overlay-top (sticky header) and data-overlay-bottom
 * (timer dock, footer). Measures the real layout instead of guessing a
 * margin, scrolls only when the element is actually covered, and never by
 * more than needed. Returns the distance scrolled.
 */
export function revealBetweenOverlays(el: Element, gap = 12): number {
  const rect = el.getBoundingClientRect()
  const tops = [...document.querySelectorAll('[data-overlay-top]')].map((o) => o.getBoundingClientRect().bottom)
  const bottoms = [...document.querySelectorAll('[data-overlay-bottom]')].map((o) => o.getBoundingClientRect().top)
  const upper = Math.max(0, ...tops) + gap
  const lower = Math.min(window.innerHeight, ...bottoms) - gap
  let delta = 0
  if (rect.bottom > lower) {
    // Scroll down, but never push the element's top under the header.
    delta = Math.min(rect.bottom - lower, Math.max(0, rect.top - upper))
  } else if (rect.top < upper) {
    delta = rect.top - upper
  }
  if (Math.abs(delta) < 1) return 0
  const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollBy({ top: delta, behavior: reduce ? 'auto' : 'smooth' })
  return delta
}
