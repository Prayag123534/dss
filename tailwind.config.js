/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f4f8ff',
          100: '#eaf1ff',
          200: '#cfe0ff',
          300: '#a4c0ff',
          400: '#6d8ef7',
          500: '#4968df',
          600: '#324db5',
          700: '#263f8d',
          800: '#1d335b',
          900: '#111c35',
        },
      },
      boxShadow: {
        soft: '0 12px 30px -18px rgba(15, 23, 42, 0.35)',
      },
    },
  },
  plugins: [],
}

