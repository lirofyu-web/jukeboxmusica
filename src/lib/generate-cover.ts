function getGradient(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue1 = Math.abs(hash) % 360;
  const hue2 = (hue1 + 50) % 360;
  return {
    start: `hsl(${hue1}, 80%, 15%)`,
    end: `hsl(${hue2}, 90%, 45%)`
  };
}

export function generateCoverSvg(month: string, year: string) {
  const { start, end } = getGradient(month + year);

  return `
<svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${start}" />
      <stop offset="100%" stop-color="${end}" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  
  <rect width="100%" height="100%" fill="url(#bg)" />
  
  <path d="M0 200 L800 200 M0 400 L800 400 M0 600 L800 600" stroke="rgba(255,255,255,0.05)" stroke-width="2" />
  <path d="M200 0 L200 800 M400 0 L400 800 M600 0 L600 800" stroke="rgba(255,255,255,0.05)" stroke-width="2" />

  <text x="50%" y="30%" font-family="Arial, sans-serif" font-size="44" letter-spacing="8" font-weight="900" fill="#facc15" text-anchor="middle" filter="url(#glow)">JUKEBOX MONTANHA</text>
  
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="52" fill="rgba(255,255,255,0.9)" font-weight="600" text-anchor="middle">LANÇAMENTOS</text>
  
  <text x="50%" y="65%" font-family="Arial, sans-serif" font-size="110" font-weight="900" fill="#ffffff" text-anchor="middle" text-transform="uppercase">${month}</text>
  
  <text x="50%" y="82%" font-family="Arial, sans-serif" font-size="38" letter-spacing="12" font-weight="bold" fill="rgba(255,255,255,0.4)" text-anchor="middle">${year}</text>
</svg>
`;
}

export function generateCoverDataUrl(month: string, year: string) {
  const svg = generateCoverSvg(month, year);
  const base64 = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${base64}`;
}
