/** Distance shown on the HUD: metres below 1 km, then km with one decimal, then whole km. */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.floor(m)} m`;
  if (m < 100_000) return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
  return `${Math.floor(m / 1000).toLocaleString('fr-FR')} km`;
}

export function formatSpeedKmh(ms: number): string {
  return `${Math.round(ms * 3.6)}`;
}

export function formatAltitude(m: number): string {
  if (m < 1000) return `${Math.floor(m)} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}
