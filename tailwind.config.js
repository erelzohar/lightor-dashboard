/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Never pure black: every bg-/text-/border-black reads as 90% black;
        // an explicit modifier (bg-black/30) still wins.
        black: 'rgba(0, 0, 0, 0.9)',
        // Built from bare channels, not var(--color-primary): Tailwind can only
        // apply an opacity modifier (bg-primary/10) to a colour it can put an
        // alpha into, and silently emits nothing for a bare variable (LT-280).
        // The channels live in index.css and ThemeContext.
        primary: {
          DEFAULT: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
          dark: 'rgb(var(--color-primary-dark-rgb) / <alpha-value>)',
        },
        light: {
          bg: 'var(--color-light-bg)',
          surface: 'var(--color-light-surface)',
          gray: 'var(--color-light-gray)',
          text: 'var(--color-light-text)',
        },
        dark: {
          bg: 'var(--color-dark-bg)',
          surface: 'var(--color-dark-surface)',
          gray: 'var(--color-dark-gray)',
          text: 'var(--color-dark-text)',
        }
      },
      fontFamily: {
        sans: ['Assistant', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(1rem)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-1rem)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};