function isElectron() {
  return typeof window !== 'undefined' && window.process && (window.process as any).type === 'renderer' || 
         (typeof navigator === 'object' && typeof navigator.userAgent === 'string' && navigator.userAgent.indexOf('Electron') >= 0);
}

export function getProxyUrl(url: string) {
  if (isElectron()) {
    return url; // Bypasses the API proxy if in Electron (since we disable webSecurity)
  }
  return `/api/proxy-download?url=${encodeURIComponent(url)}`;
}
