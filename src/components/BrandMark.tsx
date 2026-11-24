/** FRAME mark: corner brackets of a viewfinder around an empty center. */
export function BrandMark({ size = 22, className = 'brand-mark' }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 9V5a2 2 0 0 1 2-2h4M15 3h4a2 2 0 0 1 2 2v4M21 15v4a2 2 0 0 1-2 2h-4M9 21H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="9" y="9" width="6" height="6" rx="1.2" fill="currentColor" opacity="0.9" />
    </svg>
  )
}

export function Brand() {
  return (
    <span className="brand">
      <BrandMark />
      FRAME
    </span>
  )
}
