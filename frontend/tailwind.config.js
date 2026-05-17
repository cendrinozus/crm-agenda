/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Instrument Serif', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#EDF2FF',
          100: '#C8D8F8',
          200: '#8AAAE8',
          400: '#4272CC',
          500: '#2755A8',
          600: '#1B3F7E',
          700: '#122C5E',
          900: '#0A1A3A',
        },
        navy: {
          700: '#1E2E50',
          800: '#182540',
          900: '#111D30',
        },
        accent: {
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
        },
        surface: {
          0:   '#FFFFFF',
          50:  '#F8F9FC',
          100: '#F1F3F9',
          200: '#E4E8F2',
          300: '#CDD3E3',
          600: '#6B7A99',
          700: '#4B5675',
          900: '#0F1629',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(15,22,41,0.06), 0 1px 2px rgba(15,22,41,0.04)',
        'card-hover': '0 4px 12px rgba(15,22,41,0.10), 0 1px 3px rgba(15,22,41,0.06)',
        dialog: '0 20px 60px rgba(15,22,41,0.18)',
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
}
