import type { Config } from 'tailwindcss'
import { palette } from './src/lib/theme'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Semantic names — same values as src/lib/theme.ts
        ink: palette.ink,
        secondary: palette.secondary,
        muted: palette.muted,
        line: palette.line,
        parchment: palette.parchment,
        cream: {
          DEFAULT: palette.cream,
          mid: palette.line,
        },
        // Earlier names, kept so existing classes keep working
        espresso: palette.ink,
        'near-black': palette.nearBlack,
        'warm-tan': palette.line,
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
