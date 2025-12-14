/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontSize: {
        'xs': ['0.875rem', { lineHeight: '1.5' }],       // 14px - Even larger for better readability
        'sm': ['1rem', { lineHeight: '1.6' }],           // 16px - Increased from 15px
        'base': ['1.125rem', { lineHeight: '1.6' }],     // 18px - Increased from 16px
        'lg': ['1.25rem', { lineHeight: '1.6' }],        // 20px - Increased from 18px
        'xl': ['1.5rem', { lineHeight: '1.5' }],         // 24px - Increased from 21px
        '2xl': ['1.875rem', { lineHeight: '1.4' }],      // 30px - For prominent text
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', "Liberation Mono", "Courier New", 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        cyber: {
          black: '#0f172a',     // Slate 900 (Lighter background)
          dark: '#1e293b',      // Slate 800 (Panel background)
          card: '#334155',      // Slate 700 (Card background)
          border: '#334155',    // Slate 700 (Border)
          text: '#ffffff',      // Pure white (Better contrast)
          muted: '#cbd5e1',     // Slate 300 (Brighter muted text)
          primary: '#38bdf8',   // Sky 400 (Friendly Blue)
          secondary: '#818cf8', // Indigo 400
          success: '#34d399',   // Emerald 400
          danger: '#fb7185',    // Rose 400
          warning: '#fbbf24',   // Amber 400
        }
      },
      boxShadow: {
        'neon': '0 0 10px rgba(56, 189, 248, 0.2), 0 0 20px rgba(56, 189, 248, 0.05)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
      }
    }
  },
  plugins: [],
}
