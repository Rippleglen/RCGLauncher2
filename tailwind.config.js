/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/**/*.{html,js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          900: '#0f0f13',   // titlebar, sidebar
          800: '#16161b',   // panels, cards
          700: '#1c1c23',   // main content bg
          600: '#25252d',   // borders, dividers
          500: '#32323c',   // hover states
        },
        accent: {
          DEFAULT: '#16c653',
          hover:   '#1ad45b',
          muted:   'rgba(22, 198, 83, 0.12)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
