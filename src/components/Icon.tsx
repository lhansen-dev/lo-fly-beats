import type { ReactNode } from 'react'

type IconName = 'play' | 'pause' | 'shuffle' | 'volume' | 'rain' | 'moon' | 'sun' | 'scan' | 'download' | 'fly'
const paths: Record<IconName, ReactNode> = {
  play: <path d="m9 5 11 7-11 7Z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  shuffle: <path d="M3 6h3c5 0 7 12 12 12h3M18 15l3 3-3 3M3 18h3c2 0 4-3 6-6s4-6 6-6h3M18 3l3 3-3 3" />,
  volume: <path d="m11 4-5 4H3v8h3l5 4ZM15 8c3 2 3 6 0 8M18 5c5 4 5 10 0 14" />,
  rain: <path d="M6 14a5 5 0 1 1 2-9 6 6 0 0 1 11 3 3 3 0 0 1 0 6M8 17l-1 3M13 17l-1 3M18 17l-1 3" />,
  moon: <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5" /></>,
  scan: <><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M2 12h20" /><circle cx="12" cy="12" r="4" /></>,
  download: <path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" />,
  fly: <><ellipse cx="8" cy="9" rx="4" ry="6" transform="rotate(-35 8 9)" /><ellipse cx="16" cy="9" rx="4" ry="6" transform="rotate(35 16 9)" /><path d="M12 9v12M8 17h8M9 5l-2-2M15 5l2-2" /><circle cx="12" cy="8" r="2" /></>,
}
export default function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return <svg className={`icon ${className}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
