/**
 * ProximityRadar — the hero's "live diagrammatic object".
 *
 * A purely visual SVG artifact rendered in the Simile "instrument" idiom:
 * hairline concentric rings, a rotating coral sweep wedge, and a handful of
 * coral dots pulsing at deterministic polar coordinates. Coordinates and
 * counter are typeset in Geist Mono to feel like readout, not decoration.
 *
 * No canvas, no JS animation loop — the sweep is a CSS keyframe and the dots
 * pulse via staggered animation-delay. Deterministic dot positions keep the
 * artifact identical across renders (no CLS, no flicker).
 */

const RINGS = [0.2, 0.45, 0.72, 1.0]

// Hand-placed polar coordinates (r 0..1, angle in degrees). Deterministic.
const DOTS: Array<{ r: number; angle: number; delay: number }> = [
  { r: 0.35, angle: 40,  delay: 0 },
  { r: 0.58, angle: 115, delay: 350 },
  { r: 0.22, angle: 210, delay: 700 },
  { r: 0.78, angle: 285, delay: 200 },
  { r: 0.68, angle: 15,  delay: 900 },
  { r: 0.45, angle: 165, delay: 500 },
]

function polar(r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return { x: 50 + r * 48 * Math.cos(rad), y: 50 + r * 48 * Math.sin(rad) }
}

export default function ProximityRadar() {
  return (
    <div className="w-full max-w-[420px] mx-auto select-none">
      <div className="relative aspect-square">
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          aria-hidden
        >
          <defs>
            <radialGradient id="sweep-gradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0" />
              <stop offset="70%" stopColor="var(--accent-primary)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.35" />
            </radialGradient>
          </defs>

          {/* Concentric rings */}
          {RINGS.map((r, i) => (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={r * 48}
              fill="none"
              stroke="var(--border-strong)"
              strokeWidth={r === 1.0 ? 0.4 : 0.25}
            />
          ))}

          {/* Crosshair */}
          <line x1="50" y1="2"  x2="50" y2="98" stroke="var(--border-strong)" strokeWidth="0.2" />
          <line x1="2"  y1="50" x2="98" y2="50" stroke="var(--border-strong)" strokeWidth="0.2" />

          {/* Rotating sweep wedge */}
          <g className="animate-radar" style={{ transformOrigin: '50px 50px' }}>
            <path
              d="M 50 50 L 50 2 A 48 48 0 0 1 90 26 Z"
              fill="url(#sweep-gradient)"
            />
            <line
              x1="50"
              y1="50"
              x2="50"
              y2="2"
              stroke="var(--accent-primary)"
              strokeWidth="0.6"
              strokeLinecap="round"
            />
          </g>

          {/* Dots */}
          {DOTS.map((d, i) => {
            const { x, y } = polar(d.r, d.angle)
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="0.9"
                fill="var(--accent-primary)"
                className="animate-pulse"
                style={{ animationDelay: `${d.delay}ms` }}
              />
            )
          })}

          {/* Center mark */}
          <circle cx="50" cy="50" r="0.6" fill="var(--text-primary)" />
        </svg>

        {/* Compass labels over SVG */}
        <div className="absolute inset-0 pointer-events-none font-pixel text-[10px] uppercase tracking-[0.15em] text-[var(--text-tertiary)]">
          <span className="absolute top-1 left-1/2 -translate-x-1/2">N</span>
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2">S</span>
          <span className="absolute left-1 top-1/2 -translate-y-1/2">W</span>
          <span className="absolute right-1 top-1/2 -translate-y-1/2">E</span>
        </div>
      </div>

      {/* Readout block */}
      <div className="mt-6 font-pixel text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)] leading-[1.9] tabular-nums">
        <div className="flex justify-between">
          <span>Lat</span>
          <span className="text-[var(--text-primary)]">42° 21′ N</span>
        </div>
        <div className="flex justify-between">
          <span>Lng</span>
          <span className="text-[var(--text-primary)]">71° 03′ W</span>
        </div>
        <div className="flex justify-between">
          <span>Nearby</span>
          <span className="text-[var(--accent-primary)]">{DOTS.length.toString().padStart(2, '0')} within 2 km</span>
        </div>
      </div>
    </div>
  )
}
