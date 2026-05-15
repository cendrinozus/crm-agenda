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
          50:  '#FBF6E8',
          100: '#F5E8C0',
          200: '#EDD07A',
          400: '#D4A830',
          500: '#C89020',
          600: '#A07218',
          700: '#7A5510',
          900: '#4A3206',
        },
        navy: {
          700: '#2D2565',
          800: '#231C4E',
          900: '#1A1535',
        },
        accent: {
          400: '#7DBEFF',
          500: '#4B87F7',
          600: '#2D65E0',
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
