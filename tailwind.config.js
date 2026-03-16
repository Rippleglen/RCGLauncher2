/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/**/*.{html,js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // RCG palette — matches existing UI
        surface: {
          900: '#1e1e1e',
          800: '#252525',
          700: '#303030',
          600: '#3a3a3a',
          500: '#444444',
        },
        accent: {
          DEFAULT: '#008542',
          hover: '#00a050',
          muted: 'rgba(10, 152, 81, 0.192)',
        }
      },
      fontFamily: {
        sans: ['Open Sans', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
