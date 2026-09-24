import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#2563eb',
          600: '#155eef',
          700: '#0b4dd8'
        }
      },
      boxShadow: {
        soft: '0 18px 50px rgba(16, 24, 40, 0.08)'
      }
    }
  },
  plugins: []
};

export default config;
