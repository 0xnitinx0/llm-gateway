/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gateway: {
          dark: '#0f172a',
          darker: '#090d16',
          sidebar: '#0d131f',
          accent: '#2563eb',
          accentHover: '#1d4ed8',
          subtle: '#f8fafc',
          border: '#e2e8f0',
        }
      }
    },
  },
  plugins: [],
}
