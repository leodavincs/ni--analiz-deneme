// Sol üstteki "pusula/radar" amblemi — canlı, sürekli tarayan animasyonlu sürüm.
// Statik radar.svg yerine kullanılır: dönen tarama hüzmesi, sonar nabızları,
// dolaşan bir blip ve nabız atan merkez çekirdek.

type Props = { className?: string };

export function RadarLogo({ className }: Props) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="Canlı radar"
    >
      <defs>
        {/* Tarama hüzmesinin keskinden saydama geçişi (sonar kuyruğu) */}
        <linearGradient id="radar-sweep" x1="16" y1="16" x2="16" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3df5a0" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#3df5a0" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="radar-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#aeffd9" />
          <stop offset="100%" stopColor="#3df5a0" />
        </radialGradient>
      </defs>

      {/* Dış gövde */}
      <circle cx="16" cy="16" r="14" fill="#070809" stroke="#3df5a0" strokeWidth="1.2" opacity="0.5" />

      {/* Arada bir yanan kırmızı alarm halkası (hedef tespiti) */}
      <circle className="radar-alert" cx="16" cy="16" r="14" fill="none" stroke="#ff4d5e" strokeWidth="1.4" />

      {/* Genişleyip sönen sonar halkaları */}
      <circle className="radar-ping" cx="16" cy="16" r="3" fill="none" stroke="#3df5a0" strokeWidth="1" />
      <circle
        className="radar-ping"
        cx="16"
        cy="16"
        r="3"
        fill="none"
        stroke="#3df5a0"
        strokeWidth="1"
        style={{ animationDelay: "1.8s" }}
      />

      {/* Sabit referans halkaları + nişangah çizgileri */}
      <circle cx="16" cy="16" r="9" fill="none" stroke="#3df5a0" strokeWidth="1" opacity="0.35" />
      <line x1="16" y1="3" x2="16" y2="29" stroke="#3df5a0" strokeWidth="0.5" opacity="0.18" />
      <line x1="3" y1="16" x2="29" y2="16" stroke="#3df5a0" strokeWidth="0.5" opacity="0.18" />

      {/* Dönen tarama hüzmesi */}
      <g className="radar-sweep-rot" style={{ transformOrigin: "16px 16px" }}>
        <path d="M16 16 L16 3 A13 13 0 0 1 27 11 Z" fill="url(#radar-sweep)" />
        <line x1="16" y1="16" x2="16" y2="3" stroke="#3df5a0" strokeWidth="1" opacity="0.85" />
      </g>

      {/* Hüzme geçtikçe yanıp sönen hedef blip'i (arada kırmızıya döner) */}
      <circle className="radar-blip" cx="22.5" cy="10.5" r="1.3" fill="#aeffd9" />

      {/* Nabız atan merkez çekirdek */}
      <circle className="radar-core" cx="16" cy="16" r="2.4" fill="url(#radar-core)" style={{ transformOrigin: "16px 16px" }} />
    </svg>
  );
}
