import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          primary: "var(--brand-primary)",
          "primary-dark": "var(--brand-primary-dark)",
          blue: "var(--brand-blue)",
          grey: "var(--brand-grey)",
          light: "var(--brand-light)",
          red: "#e10600", // Keep for backward compatibility
          redDark: "#b00000", // Keep for backward compatibility
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "League Spartan", "sans-serif"],
        body: ["var(--font-body)", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;

