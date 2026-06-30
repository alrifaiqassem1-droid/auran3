import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1.5rem' },
    extend: {
      fontFamily: {
        ar: ['var(--font-tajawal)', 'system-ui', 'sans-serif'],
        en: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        status: {
          expired:  { DEFAULT: 'hsl(var(--status-expired-bg))',  foreground: 'hsl(var(--status-expired-fg))'  },
          critical: { DEFAULT: 'hsl(var(--status-critical-bg))', foreground: 'hsl(var(--status-critical-fg))' },
          warning:  { DEFAULT: 'hsl(var(--status-warning-bg))',  foreground: 'hsl(var(--status-warning-fg))'  },
          safe:     { DEFAULT: 'hsl(var(--status-safe-bg))',     foreground: 'hsl(var(--status-safe-fg))'     },
          none:     { DEFAULT: 'hsl(var(--status-none-bg))',     foreground: 'hsl(var(--status-none-fg))'     },
        },
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
      keyframes: {
        'aura-breathe': { '0%,100%': { transform: 'scale(1)', opacity: '0.55' }, '50%': { transform: 'scale(1.12)', opacity: '0.85' } },
        'aura-spin': { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        'aura-breathe': 'aura-breathe 7s ease-in-out infinite',
        'aura-spin': 'aura-spin 24s linear infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
