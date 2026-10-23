import type { ReactNode } from 'react'

/** Local Lucide-style stroked icons: no network fonts, tracking or CDN. */
const shapes: Record<string, ReactNode> = {
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></>,
  upload: <><path d="M12 16V4m-4 4 4-4 4 4"/><path d="M4 16v4h16v-4"/></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></>,
  scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3m8 0h3a1 1 0 0 1 1 1v3M4 16v3a1 1 0 0 0 1 1h3m8 0h3a1 1 0 0 0 1-1v-3M7 12h10"/></>,
  layers: <><path d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5"/></>,
  report: <><path d="M8 2h8l4 4v16H4V2h4M16 2v5h4M8 12h8M8 16h6"/></>,
  settings: <><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M18.4 5.6l-2.1 2.1m-8.6 8.6-2.1 2.1"/><circle cx="12" cy="12" r="4"/></>,
  info: <><circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10h.01"/></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
  close: <path d="M18 6 6 18M6 6l12 12"/>,
  collapse: <path d="m14 7-5 5 5 5"/>,
  expand: <path d="m10 7 5 5-5 5"/>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>,
  moon: <path d="M20.9 13a9 9 0 0 1-9.9-9.9A9 9 0 1 0 20.9 13Z"/>,
  monitor: <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  checkCircle: <><circle cx="12" cy="12" r="10"/><path d="m7 12 3 3 7-7"/></>,
  alert: <><path d="m10.3 3.8-8.4 14.5A2 2 0 0 0 3.6 21h16.8a2 2 0 0 0 1.7-2.7L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/></>,
  bolt: <path d="m13 2-9 12h7l-1 8 10-12h-7l0-8Z"/>,
  lock: <><rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v4"/></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
  download: <><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/></>,
  arrowRight: <path d="M5 12h14m-6-6 6 6-6 6"/>,
  arrowLeft: <path d="M19 12H5m6-6-6 6 6 6"/>,
  wand: <><path d="m4 20 12-12 4 4L8 24M14 4l1 2m5 0-2 1M9 2l1 2"/></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 16 5-5 4 4 3-3 6 6"/></>,
  privacy: <><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 12h6m-3-3v6"/></>,
  sparkle: <><path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/></>,
  chevronRight: <path d="m9 18 6-6-6-6"/>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>,
}

export default function Icon({ name, size = 18, className = '' }: { name: string; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" focusable="false">
      {shapes[name] ?? shapes.shield}
    </svg>
  )
}
