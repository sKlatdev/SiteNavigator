/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: false,
  theme: {
    extend: {
      colors: {
        "bg-base": "var(--bg-base)",
        "bg-panel": "var(--bg-panel)",
        "bg-overlay": "var(--bg-overlay)",
        "border-subtle": "var(--border-subtle)",
        "border-strong": "var(--border-strong)",
        "accent": "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-press": "var(--accent-press)",
        "success": "var(--success)",
        "warning": "var(--warning)",
        "critical": "var(--critical)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
      },
      borderRadius: {
        "container": "var(--radius-container)",
        "control": "var(--radius-control)",
        "pill": "var(--radius-pill)",
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      boxShadow: {
        "panel": "var(--shadow-panel)",
        "overlay": "var(--shadow-overlay)",
      },
      transitionDuration: {
        "motion-fast": "var(--motion-fast)",
        "motion-medium": "var(--motion-medium)",
      },
    },
  },
  plugins: [],
}

