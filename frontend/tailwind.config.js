/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--color-canvas-rgb) / <alpha-value>)',
        surface: 'rgb(var(--color-surface-rgb) / <alpha-value>)',
        earth: {
          50: '#F8F2E8', 100: '#F0E6D7', 200: '#DDCFBC', 300: '#C7B59C',
          400: '#94816D', 500: '#746354', 600: '#655344', 700: '#534234',
          800: '#443428', 900: '#342820', 950: '#241B15',
        },
        accent: {
          50: '#FFF1E8', 100: '#FAE1CE', 200: '#F1BFA0', 300: '#E99D73',
          400: '#D87A4E', 500: '#C76235', 600: '#B84C24', 700: '#923B1D',
          800: '#76301B', 900: '#612B1B',
        },
        clay: {
          50: '#F8EDE6', 100: '#F1DCCE', 200: '#E1BBA5', 300: '#CB957A',
          400: '#B77658', 500: '#A46245', 600: '#8C5038', 700: '#73412D',
        },
        ochre: {
          50: '#FCF4E7', 100: '#F5E6C6', 200: '#E9CE95', 300: '#D9B568',
          400: '#BF9449', 500: '#A57A34', 600: '#896026', 700: '#714C20',
        },
      },
      boxShadow: {
        warm: '0 4px 20px -8px rgba(83, 66, 52, 0.12)',
      },
    },
  },
  plugins: [],
};
