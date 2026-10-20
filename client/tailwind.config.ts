import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        primary: {
          50: 'var(--primary-50)', 100: 'var(--primary-100)', 200: 'var(--primary-200)',
          400: 'var(--primary-400)', 500: 'var(--primary-500)', 600: 'var(--primary-600)',
          700: 'var(--primary-700)', 900: 'var(--primary-900)',
        },
        contrast: { bg: 'var(--contrast-bg)', text: 'var(--contrast-text)' },
        success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)',
        info: 'var(--info)', violet: 'var(--violet)', teal: 'var(--teal)',
        bg: 'var(--bg)', surface: 'var(--surface)', 'surface-2': 'var(--surface-2)',
        border: 'var(--border)', text: 'var(--text)',
        muted: 'var(--text-muted)', faint: 'var(--text-faint)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)', md: 'var(--radius-md)',
        lg: 'var(--radius-lg)', xl: 'var(--radius-xl)',
      },
      boxShadow: {
        1: 'var(--shadow-1)', 2: 'var(--shadow-2)', 3: 'var(--shadow-3)',
        4: 'var(--shadow-4)', glow: 'var(--shadow-glow)',
      },
      backgroundImage: {
        'grad-primary': 'var(--grad-primary)',
        'grad-hero': 'var(--grad-hero)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)', spring: 'var(--spring)',
      },
      fontSize: {
        display: ['40px', { lineHeight: '48px', fontWeight: '800' }],
        h1: ['28px', { lineHeight: '36px', fontWeight: '700' }],
        h2: ['22px', { lineHeight: '30px', fontWeight: '700' }],
        h3: ['18px', { lineHeight: '26px', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '24px' }],
        body: ['14px', { lineHeight: '22px' }],
        'body-sm': ['13px', { lineHeight: '20px' }],
        caption: ['12px', { lineHeight: '18px', fontWeight: '500' }],
      },
    },
  },
} satisfies Config;