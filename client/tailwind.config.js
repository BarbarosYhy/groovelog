/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        vinyl: {
          bg: '#0d0d0d',
          surface: '#1a1a1a',
          card: '#242424',
          border: '#333333',
          amber: '#f59e0b',
          'amber-light': '#fbbf24',
          muted: '#6b7280',
          text: '#e5e7eb',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
