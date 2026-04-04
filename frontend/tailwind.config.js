export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0a",
        surface: "#111111",
        surfaceHover: "#1a1a1a",
        border: "#2a2a2a",
        text: "#e5e5e5",
        textMuted: "#737373",

        neon: {
          red: {
            DEFAULT: "#ff0066",
            glow: "rgba(255, 0, 102, 0.6)",
            dim: "rgba(255, 0, 102, 0.2)",
          },
          blue: {
            DEFAULT: "#00f3ff",
            glow: "rgba(0, 243, 255, 0.6)",
            dim: "rgba(0, 243, 255, 0.2)",
          },
          purple: {
            DEFAULT: "#9d00ff",
            glow: "rgba(157, 0, 255, 0.6)",
            dim: "rgba(157, 0, 255, 0.2)",
          },
          cyan: {
            DEFAULT: "#00ffff",
            glow: "rgba(0, 255, 255, 0.6)",
            dim: "rgba(0, 255, 255, 0.2)",
          },
          green: {
            DEFAULT: "#00ff00",
            glow: "rgba(0, 255, 0, 0.6)",
            dim: "rgba(0, 255, 0, 0.2)",
          },
          yellow: {
            DEFAULT: "#ffff00",
            glow: "rgba(255, 255, 0, 0.6)",
            dim: "rgba(255, 255, 0, 0.2)",
          },
        },
      },
      fontFamily: {
        mono: ["Orbitron", "Courier New", "monospace"],
      },
      boxShadow: {
        "glow-red":
          "0 0 20px rgba(255, 0, 102, 0.5), 0 0 40px rgba(255, 0, 102, 0.3)",
        "glow-red-strong":
          "0 0 30px rgba(255, 0, 102, 0.7), 0 0 60px rgba(255, 0, 102, 0.5)",
        "glow-blue":
          "0 0 20px rgba(0, 243, 255, 0.5), 0 0 40px rgba(0, 243, 255, 0.3)",
        "glow-blue-strong":
          "0 0 30px rgba(0, 243, 255, 0.7), 0 0 60px rgba(0, 243, 255, 0.5)",
        "glow-purple":
          "0 0 20px rgba(157, 0, 255, 0.5), 0 0 40px rgba(157, 0, 255, 0.3)",
        "glow-purple-strong":
          "0 0 30px rgba(157, 0, 255, 0.7), 0 0 60px rgba(157, 0, 255, 0.5)",
        "glow-cyan":
          "0 0 20px rgba(0, 255, 255, 0.5), 0 0 40px rgba(0, 255, 255, 0.3)",
        "glow-cyan-strong":
          "0 0 30px rgba(0, 255, 255, 0.7), 0 0 60px rgba(0, 255, 255, 0.5)",
        "glow-green":
          "0 0 20px rgba(0, 255, 0, 0.5), 0 0 40px rgba(0, 255, 0, 0.3)",
        "glow-green-strong":
          "0 0 30px rgba(0, 255, 0, 0.7), 0 0 60px rgba(0, 255, 0, 0.5)",
        "glow-yellow":
          "0 0 20px rgba(255, 255, 0, 0.5), 0 0 40px rgba(255, 255, 0, 0.3)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        breathing: "breathe 2s ease-in-out infinite",
        flicker: "flicker 0.15s infinite",
        scan: "scan 8s linear infinite",
      },
      keyframes: {
        breathe: {
          "0%, 100%": { opacity: "0.5", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.02)" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "41.99%": { opacity: "1" },
          "42%": { opacity: "0.8" },
          "43%": { opacity: "1" },
          "63.99%": { opacity: "1" },
          "64%": { opacity: "0.5" },
          "65%": { opacity: "1" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
    },
  },
  plugins: [],
};
