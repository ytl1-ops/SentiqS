/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        fontFamily: {
          sans: ['Inter', 'system-ui', 'sans-serif'],
          heading: ['Inter', 'system-ui', 'sans-serif'],
        },
        colors: {
          sentiqs: {
            navy: '#1a2d4a',
            'navy-light': '#2a3f5a',
            blue: '#2563eb',
            'blue-dark': '#1d4ed8',
            'gray-bg': '#eef2f7',
            'gray-text': '#64748b',
            'gray-border': '#d1d5db',
            'gray-light': '#f8fafc',
            // Palette "Salle de crise" (mode sombre)
            crisis: {
              bg: '#0a0e17',
              panel: '#111826',
              'panel-border': '#1e2536',
              surface: '#0f1420',
              'surface-alt': '#0d1220',
              border: '#1b2434',
              'border-soft': '#1e2942',
              input: '#141b2c',
              text: '#e8ecf4',
              'text-muted': '#7c8aa8',
              'text-dim': '#8b98b8',
              'text-faint': '#465066',
              accent: '#0891a8',
              'accent-bright': '#22d3ee',
            },
          }
        }
      },
    },
    plugins: [],
  }