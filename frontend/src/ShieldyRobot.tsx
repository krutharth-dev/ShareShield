import { useId } from 'react'

type RobotMood = 'happy' | 'thinking' | 'alert'
type RobotProps = {
  mood?: RobotMood
  variant?: 'full' | 'head'
  size?: number
  className?: string
}

/**
 * Shieldy is a first-party SVG mascot, not a fetched image or an AI avatar.
 * Both eyes, arms, antenna and status indicator can animate with CSS, and
 * all decorative motion follows the existing opt-out / Reduce Motion settings.
 */
export default function ShieldyRobot({
  mood = 'happy', variant = 'full', size = 120, className = '',
}: RobotProps) {
  const id = useId().replace(/:/g, '')
  const mint = 'shieldyMint' + id
  const body = 'shieldyBody' + id
  const screen = 'shieldyScreen' + id
  const shine = 'shieldyShine' + id
  const shadow = 'shieldyShadow' + id
  const headOnly = variant === 'head'
  return (
    <svg className={['shieldy-robot', 'shieldy-robot-' + variant, 'shieldy-robot-' + mood, className].filter(Boolean).join(' ')}
      width={size} height={Math.round(size * (headOnly ? 1 : 185 / 160))}
      viewBox={headOnly ? '19 4 122 124' : '0 0 160 185'}
      fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={mint} x1="25" y1="16" x2="139" y2="139" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D6F6FF"/>
          <stop offset=".34" stopColor="#89D9FA"/>
          <stop offset=".78" stopColor="#447EC9"/>
          <stop offset="1" stopColor="#254A8F"/>
        </linearGradient>
        <linearGradient id={body} x1="50" y1="115" x2="114" y2="175" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C5EFFF"/>
          <stop offset=".55" stopColor="#66BDEB"/>
          <stop offset="1" stopColor="#3165AD"/>
        </linearGradient>
        <linearGradient id={screen} x1="43" y1="40" x2="115" y2="115" gradientUnits="userSpaceOnUse">
          <stop stopColor="#182B55"/>
          <stop offset="1" stopColor="#081427"/>
        </linearGradient>
        <linearGradient id={shine} x1="30" y1="24" x2="93" y2="106" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity=".65"/>
          <stop offset=".7" stopColor="#FFFFFF" stopOpacity="0"/>
        </linearGradient>
        <filter id={shadow} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#071C3A" floodOpacity=".23"/>
        </filter>
      </defs>

      {!headOnly && <>
        <ellipse className="bot-ground" cx="80" cy="179" rx="45" ry="5" fill="#091D3D" opacity=".16"/>
        <g className="bot-legs">
          <rect x="54" y="159" width="16" height="19" rx="8" fill="#305B9F"/>
          <rect x="90" y="159" width="16" height="19" rx="8" fill="#305B9F"/>
          <rect x="47" y="169" width="29" height="11" rx="6" fill="#193E75"/>
          <rect x="85" y="169" width="29" height="11" rx="6" fill="#193E75"/>
          <rect x="50" y="171" width="18" height="2.7" rx="1.35" fill="#D6F5FF" opacity=".8"/>
          <rect x="89" y="171" width="18" height="2.7" rx="1.35" fill="#D6F5FF" opacity=".8"/>
        </g>
        <g className="bot-left-arm">
          <rect x="24" y="120" width="24" height="34" rx="12" fill="#4F98D6" stroke="#245A92" strokeWidth="3" transform="rotate(20 36 137)"/>
          <circle cx="26" cy="154" r="11" fill={'url(#' + mint + ')'} stroke="#2A639F" strokeWidth="3"/>
          <circle cx="26" cy="154" r="4.3" fill="#D8F5FF"/>
        </g>
        <g className="bot-wave-arm">
          <rect x="112" y="120" width="24" height="34" rx="12" fill="#5AADE4" stroke="#245A92" strokeWidth="3" transform="rotate(-26 125 134)"/>
          <circle cx="139" cy="110" r="12" fill="#72CCF3" stroke="#2A6EB1" strokeWidth="3"/>
          <circle cx="139" cy="110" r="5" fill="#D8F5FF"/>
        </g>
        <g filter={'url(#' + shadow + ')'}>
          <rect x="40" y="111" width="80" height="61" rx="27" fill={'url(#' + body + ')'} stroke="#2D65AB" strokeWidth="3"/>
          <path d="M55 121 Q80 130 106 121" stroke="#FFFFFF" strokeOpacity=".55" strokeWidth="4" strokeLinecap="round"/>
          <rect x="57" y="131" width="47" height="28" rx="12" fill="#254C8A" stroke="#92DFFF" strokeWidth="2"/>
          <path d="M81 136 92 141v6c0 6-5 10-11 13-6-3-11-7-11-13v-6l11-5Z" fill="#D8F5FF"/>
          <path d="m76 146 4 4 7-7" stroke="#2D70AC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle className="bot-chest-led" cx="110" cy="150" r="3.5" fill="#A8C4FF"/>
        </g>
      </>}

      <g className="bot-antenna">
        <rect x="76" y="17" width="8" height="22" rx="4" fill="#2C5A95"/>
        <circle cx="80" cy="13" r="10" fill="#9DE6FF" stroke="#3479BD" strokeWidth="3"/>
        <circle className="bot-antenna-core" cx="80" cy="13" r="4" fill="#F2FBFF"/>
      </g>
      <g filter={'url(#' + shadow + ')'}>
        <rect x="21" y="58" width="18" height="34" rx="9" fill="#3D8ACD" stroke="#245B91" strokeWidth="3"/>
        <rect x="121" y="58" width="18" height="34" rx="9" fill="#3D8ACD" stroke="#245B91" strokeWidth="3"/>
        <circle cx="30" cy="75" r="5" fill="#D6F8FF"/>
        <circle cx="130" cy="75" r="5" fill="#D6F8FF"/>

        <rect x="29" y="26" width="102" height="98" rx="34" fill={'url(#' + mint + ')'} stroke="#2D66A8" strokeWidth="3"/>
        <path d="M42 38Q59 25 83 30" stroke="#FFFFFF" strokeOpacity=".76" strokeWidth="5" strokeLinecap="round"/>
        <rect x="41" y="40" width="78" height="68" rx="25" fill={'url(#' + screen + ')'} stroke="#285C9F" strokeWidth="2.5"/>
        <path d="M46 62C48 52 55 47 65 46H88" stroke={'url(#' + shine + ')'} strokeWidth="8" strokeLinecap="round"/>
        <rect x="48" y="45" width="64" height="7" rx="3.5" fill="#DFF8FF" opacity=".08"/>
        <g className="bot-face">
          <rect className="bot-eye bot-eye-left" x="54" y="66" width={mood === 'alert' ? 18 : 17} height="18" rx="8.5" fill={mood === 'alert' ? '#FFE2A0' : '#9EECFF'}/>
          <rect className="bot-eye bot-eye-right" x="89" y="66" width="17" height="18" rx="8.5" fill={mood === 'alert' ? '#FFE2A0' : '#9EECFF'}/>
          {mood === 'thinking' ? <circle cx="80" cy="95" r="3.8" stroke="#9EECFF" strokeWidth="3"/> :
            mood === 'alert' ? <path d="M73 94H86" stroke="#FFE2A0" strokeWidth="3.5" strokeLinecap="round"/> :
              <path d="M69 92Q80 103 91 92" stroke="#9EECFF" strokeWidth="3.6" strokeLinecap="round"/>}
          <circle cx="49" cy="90" r="3" fill="#E5A6EA" opacity=".68"/>
          <circle cx="111" cy="90" r="3" fill="#E5A6EA" opacity=".68"/>
        </g>
        <rect x="58" y="113" width="44" height="4" rx="2" fill="#C9EFFF" opacity=".58"/>
      </g>
      <g className="bot-sparkles">
        <path d="m13 33 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill="#BBF2FF"/>
        <path d="m145 41 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5 1.5-4Z" fill="#9BDFFF"/>
        {!headOnly && <circle cx="132" cy="169" r="3" fill="#C6FFDB"/>}
      </g>
    </svg>
  )
}
