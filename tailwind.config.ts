import type { Config } from 'tailwindcss'

// Renkler ve yazı tipi Künye'nin (rraeyz.me) temasıyla aynı: mor #8b5cf6 / #c4b5fd, Sora
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  // Tema: varsayılan cihazınki; okur seçtiyse <html class="light|dark"> (ThemeToggle). Otomatik durum JavaScript'siz çalışır
  darkMode: ['variant', ['@media (prefers-color-scheme: dark) { &:not(.light *) }', '&:is(.dark *)']],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#07070c', card: '#11111a', line: 'rgba(255,255,255,0.1)' },
        paper: '#f5f5f7',
      },
      fontFamily: {
        display: ['"Sora Variable"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        blob: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(30px, -40px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.92)' },
        },
      },
      animation: { blob: 'blob 14s ease-in-out infinite' },
    },
  },
  plugins: [],
}
export default config
