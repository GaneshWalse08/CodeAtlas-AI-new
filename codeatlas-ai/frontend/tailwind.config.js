/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "#0B0E14",
        surface: "#12161F",
        "surface-elevated": "#1A1F2B",
        border: "#242B38",
        "text-primary": "#E6E9EF",
        "text-secondary": "#8A93A6",
        "text-disabled": "#4B5262",

        accent: {
          DEFAULT: "#5B8CFF",
          hover: "#7AA0FF",
          pressed: "#4570E6",
        },

        risk: {
          low: "#3ECF8E",
          medium: "#F5B942",
          high: "#F0553F",
          unknown: "#4B5262",
        },

        status: {
          success: "#3ECF8E",
          warning: "#F5B942",
          error: "#F0553F",
          info: "#5B8CFF",
        },

        chat: {
          ai: "#161B26",
          user: "#1F2937",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      borderRadius: {
        btn: "8px",
        card: "12px",
        pill: "999px",
      },
      boxShadow: {
        modal: "0 4px 16px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};
