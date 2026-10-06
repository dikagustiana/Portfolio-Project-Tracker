import { useId } from 'react'

/** SAMB wordmark and swoosh, as drawn in the prototype sidebar. The owner may supply the official logo later. */
export function BrandMark() {
  const gradient = useId()
  return (
    <div className="flex flex-col items-start gap-0.5">
      <svg viewBox="0 0 120 56" role="img" aria-label="SAMB" className="block h-auto w-[118px]">
        <defs>
          <linearGradient id={gradient} x1="0" x2="1">
            <stop offset="0" stopColor="#6f86ee" />
            <stop offset="1" stopColor="#3e55d8" />
          </linearGradient>
        </defs>
        <path
          d="M27 37C17 38 12 32 17 28.5C21 26 27 27.5 29.5 25.6C47 17 75 11 102 8.5"
          fill="none"
          stroke={`url(#${gradient})`}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <circle className="fill-brand-dot" cx="108" cy="7.5" r="4.2" />
        <text
          className="fill-ink"
          x="3"
          y="53"
          fontFamily="Georgia,'Times New Roman',serif"
          fontSize="15.5"
          fontWeight="700"
          letterSpacing="15"
        >
          SAMB
        </text>
      </svg>
      <small className="pl-0.5 text-[11.5px] font-semibold tracking-[0.02em] text-muted">Project Board</small>
    </div>
  )
}
