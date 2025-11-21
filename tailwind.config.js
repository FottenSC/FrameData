/** @type {import('tailwindcss').Config} */
export default {
    darkMode: "class",
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                border: "var(--border)",
                input: "var(--input)",
                ring: "var(--ring)",
                background: "var(--background)",
                foreground: "var(--foreground)",
                primary: {
                    DEFAULT: "var(--primary)",
                    foreground: "var(--primary-foreground)",
                },
                secondary: {
                    DEFAULT: "var(--secondary)",
                    foreground: "var(--secondary-foreground)",
                },
                destructive: {
                    DEFAULT: "var(--destructive)",
                    foreground: "var(--destructive-foreground)",
                },
                muted: {
                    DEFAULT: "var(--muted)",
                    foreground: "var(--muted-foreground)",
                },
                accent: {
                    DEFAULT: "var(--accent)",
                    foreground: "var(--accent-foreground)",
                },
                popover: {
                    DEFAULT: "var(--popover)",
                    foreground: "var(--popover-foreground)",
                },
                card: {
                    DEFAULT: "var(--card)",
                    foreground: "var(--card-foreground)",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            spacing: {
                4: "1rem",
            },
            keyframes: {
                "fade-in": {
                    "0%": { opacity: 0 },
                    "100%": { opacity: 1 },
                },
                fadeIn: {
                    from: { opacity: 0 },
                    to: { opacity: 1 },
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
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
};
