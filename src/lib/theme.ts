/**
 * Kurrent colour palette — the single source for the six brand colours.
 *
 * Components use these in inline styles (`color: palette.ink`); the same values
 * are registered as Tailwind colours in tailwind.config.ts (`text-ink`, `bg-line`
 * …) so either approach resolves to the same pixels. Email templates and PDF
 * payloads under src/app/api keep hex literals because they are serialised and
 * sent to external renderers.
 */
export const palette = {
  ink: '#2F2C25',        // primary text, dark surfaces
  secondary: '#7A7468',  // secondary text
  muted: '#9A9084',      // tertiary text, placeholders
  line: '#F1EADD',       // borders, dividers, light surfaces
  cream: '#FEFAF3',      // page background, text on dark
  parchment: '#FAF9F5',  // card background
  nearBlack: '#141413',
  white: '#FFFFFF',
} as const

export type PaletteKey = keyof typeof palette
