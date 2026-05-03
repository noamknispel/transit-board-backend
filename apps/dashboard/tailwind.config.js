/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ops: {
          950: '#071422',
          900: '#0b1f33',
          800: '#112c46',
          700: '#1a3d5f',
          600: '#275276',
          500: '#3f6a92',
          400: '#5f8db5',
          300: '#86aed0',
          200: '#b6d1e8',
          100: '#e2f0fb',
        },
        accent: {
          cyan: '#27d3d0',
          amber: '#f8b84f',
          mint: '#39d98a',
          rose: '#f96d84',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', '"Avenir Next"', 'sans-serif'],
        body: ['"Manrope"', '"Avenir Next"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        panel: '0 20px 40px -24px rgba(7, 20, 34, 0.45)',
        glow: '0 0 0 1px rgba(39, 211, 208, 0.25), 0 10px 28px -16px rgba(39, 211, 208, 0.5)',
      },
      borderRadius: {
        xl2: '1rem',
      },
    },
  },
  plugins: [],
}
