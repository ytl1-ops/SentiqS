/** @type {import('tailwindcss').Config} */
export default {
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
          }
        }
      },
    },
    plugins: [],
  }