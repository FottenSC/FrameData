/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      spacing: {
        '4': '1rem',
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 }
        },
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 }
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-in-out forwards",
        "fade-in-1": "fade-in 0.4s ease-in-out 0.1s forwards",
        "fade-in-2": "fade-in 0.4s ease-in-out 0.2s forwards",
        "fade-in-3": "fade-in 0.4s ease-in-out 0.3s forwards",
        "fade-in-4": "fade-in 0.4s ease-in-out 0.4s forwards",
        "fade-in-5": "fade-in 0.4s ease-in-out 0.5s forwards",
        "fade-in-6": "fade-in 0.4s ease-in-out 0.6s forwards",
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
} 