export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        surface: '#111111',
        surfaceHover: '#1a1a1a',
        border: '#2a2a2a',
        text: '#e5e5e5',
        textMuted: '#737373',

        neon: {
          red: {
            DEFAULT: '#dc2626',
            glow: 'rgba(220, 38, 38, 0.6)',
            dim: 'rgba(220, 38, 38, 0.2)'
          },
          blue: {
            DEFAULT: '#3b82f6',
            glow: 'rgba(59, 130, 246, 0.6)',
            dim: 'rgba(59, 130, 246, 0.2)'
          },
          purple: {
            DEFAULT: '#8b5cf6',
            glow: 'rgba(139, 92, 246, 0.6)',
            dim: 'rgba(139, 92, 246, 0.2)'
          },
          cyan: {
            DEFAULT: '#06b6d4',
            glow: 'rgba(6, 182, 212, 0.6)',
            dim: 'rgba(6, 182, 212, 0.2)'
          },
          green: {
            DEFAULT: '#22c55e',
            glow: 'rgba(34, 197, 94, 0.6)',
            dim: 'rgba(34, 197, 94, 0.2)'
          }
        }
      },
      fontFamily: {
        mono: ['Orbitron', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'glow-red': '0 0 20px rgba(220, 38, 38, 0.5), 0 0 40px rgba(220, 38, 38, 0.3)',
        'glow-red-strong': '0 0 30px rgba(220, 38, 38, 0.7), 0 0 60px rgba(220, 38, 38, 0.5)',
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3)',
        'glow-blue-strong': '0 0 30px rgba(59, 130, 246, 0.7), 0 0 60px rgba(59, 130, 246, 0.5)',
        'glow-purple': '0 0 20px rgba(139, 92, 246, 0.5), 0 0 40px rgba(139, 92, 246, 0.3)',
        'glow-purple-strong': '0 0 30px rgba(139, 92, 246, 0.7), 0 0 60px rgba(139, 92, 246, 0.5)',
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.5), 0 0 40px rgba(6, 182, 212, 0.3)',
        'glow-cyan-strong': '0 0 30px rgba(6, 182, 212, 0.7), 0 0 60px rgba(6, 182, 212, 0.5)',
        'glow-green': '0 0 20px rgba(34, 197, 94, 0.5), 0 0 40px rgba(34, 197, 94, 0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'breathing': 'breathe 2s ease-in-out infinite',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.02)' },
        }
      }
    },
  },
  plugins: [],
}
