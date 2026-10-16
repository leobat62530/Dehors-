/**
 * Colour tokens. Placeholder art direction: the final palette, character and logo plug in
 * by changing this file and the sprites only.
 */
export const THEME = {
  skyTop: '#5aa9e6',
  skyBottom: '#bfe3ff',
  ground: '#6bbf59',
  groundDark: '#3f8f3a',
  groundLine: '#2d5e2a',
  accent: '#ffc531', // coins and score
  danger: '#e63946', // obstacles
  ui: '#1b1d2a', // dark neutral for UI
  uiText: '#ffffff',
  uiTextSoft: 'rgba(255,255,255,0.78)',
  outline: '#1b1d2a',
  ghost: 'rgba(255,255,255,0.9)',
  body: '#f4a261',
  bodyShirt: '#2a9d8f',
  boot: '#5c3d2e',
  bootSole: '#ffffff',
  shade: 'rgba(27,29,42,0.55)',
  fonts: {
    display: '900 {size}px "Arial Black", Impact, "Helvetica Neue", sans-serif',
    text: '600 {size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
} as const;

export function font(kind: keyof typeof THEME.fonts, size: number): string {
  return THEME.fonts[kind].replace('{size}', String(Math.round(size)));
}
