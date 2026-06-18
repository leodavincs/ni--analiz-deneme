/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#070809",
        panel: "#0d0f13",
        card: "#11141a",
        line: "#1c212b",
        mint: "#3df5a0",
        iris: "#8b8bf5",
        amber: "#f5c451",
        slate: "#6b7686",
        ghost: "#9aa6b6",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(61,245,160,0.35), 0 0 28px -6px rgba(61,245,160,0.45)",
        soft: "0 18px 50px -24px rgba(0,0,0,0.9)",
      },
      keyframes: {
        pulseDot: {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.35", transform: "scale(0.7)" },
        },
        sweep: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(120%)" },
        },
        flowDot: {
          "0%": { left: "0%", opacity: "0", transform: "translateY(-50%) scale(0.5)" },
          "15%": { opacity: "1", transform: "translateY(-50%) scale(1)" },
          "85%": { opacity: "1", transform: "translateY(-50%) scale(1)" },
          "100%": { left: "100%", opacity: "0", transform: "translateY(-50%) scale(0.5)" },
        },
        // Elenen sinyal: ortaya kadar gelir, sonra aşağı saçılıp söner.
        // Damıtımın "az'ı geçer" hikâyesini parçacıkla anlatır.
        flowDrop: {
          "0%": { left: "0%", opacity: "0", transform: "translate(0,-50%) scale(0.5)" },
          "12%": { opacity: "0.8", transform: "translate(0,-50%) scale(1)" },
          "42%": { left: "46%", opacity: "0.5", transform: "translate(0,-50%) scale(0.8)" },
          "62%": { left: "52%", opacity: "0", transform: "translate(0,150%) scale(0.3)" },
          "100%": { left: "52%", opacity: "0", transform: "translate(0,150%) scale(0.3)" },
        },
        // Tailwind varsayılan `ping`'i (1s) ezerek tüm canlı noktaları
        // sayfanın 1.8s kalp atışına kilitler — pulseDot ile faz uyumlu.
        ping: {
          "75%,100%": { transform: "scale(2)", opacity: "0" },
        },
        // Huninin "◆ payoff" rozeti: parçacık varışıyla aynı tempoda nabız.
        payoffPulse: {
          "0%,100%": {
            transform: "scale(1)",
            boxShadow: "inset 0 0 0 1px rgba(61,245,160,0.10), 0 0 0 0 rgba(61,245,160,0)",
          },
          "50%": {
            transform: "scale(1.04)",
            boxShadow: "inset 0 0 0 1px rgba(61,245,160,0.22), 0 0 14px -2px rgba(61,245,160,0.45)",
          },
        },
      },
      animation: {
        // Ortak kalp atışı: 1.8s (radar sweep'in yarısı, flowDot ile aynı).
        pulseDot: "pulseDot 1.8s ease-in-out infinite",
        ping: "ping 1.8s cubic-bezier(0,0,0.2,1) infinite",
        sweep: "sweep 6s linear infinite",
        flowDot: "flowDot 1.8s linear infinite",
        flowDrop: "flowDrop 1.8s linear infinite",
        payoffPulse: "payoffPulse 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
