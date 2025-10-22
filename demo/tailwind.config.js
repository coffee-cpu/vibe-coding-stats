/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        coffee: {
          50: '#fdf8f3',
          100: '#f7ede3',
          200: '#eed9c4',
          300: '#e3c1a0',
          400: '#d4a574',
          500: '#c88a51',
          600: '#b87333',
          700: '#9a5f2b',
          800: '#7d4e27',
          900: '#664023',
        },
        cream: {
          50: '#fefcf9',
          100: '#fef9f2',
          200: '#fdf3e5',
          300: '#fbe9cf',
          400: '#f8ddb0',
          500: '#f4ce89',
          600: '#e9b44c',
          700: '#d69933',
          800: '#b17d2a',
          900: '#8f6526',
        },
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Consolas', 'Monaco', 'Courier New', 'monospace'],
        'serif': ['Merriweather', 'Georgia', 'serif'],
      },
      boxShadow: {
        'warm': '0 4px 6px -1px rgba(184, 115, 51, 0.1), 0 2px 4px -1px rgba(184, 115, 51, 0.06)',
        'warm-lg': '0 10px 15px -3px rgba(184, 115, 51, 0.1), 0 4px 6px -2px rgba(184, 115, 51, 0.05)',
        'warm-xl': '0 20px 25px -5px rgba(184, 115, 51, 0.1), 0 10px 10px -5px rgba(184, 115, 51, 0.04)',
      },
    },
  },
  plugins: [],
}
