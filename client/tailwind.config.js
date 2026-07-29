/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Section-specific accent colors
        programs: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
        },
        templates: {
          50: '#faf5ff',
          500: '#a855f7',
          600: '#9333ea',
        },
        measures: {
          50: '#f0fdfa',
          500: '#14b8a6',
          600: '#0d9488',
        },
        food: {
          50: '#fff7ed',
          500: '#f97316',
          600: '#ea580c',
        },
      },
      animation: {
        'bounce-check': 'bounce-check 0.3s ease',
        'pulse-glow': 'pulse-glow 2s infinite',
        'slide-up': 'slideUp 0.25s ease',
        'slide-down': 'slideDown 0.25s ease',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
};
