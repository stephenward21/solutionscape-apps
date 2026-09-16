import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // SolutionScape primary blue (matches logo left/top gradient)
        brand: {
          50:  "#EAF4FB",
          100: "#C8E6F5",
          200: "#91CEEB",
          300: "#5AB5E1",
          400: "#3AA3D7",
          500: "#2A8EC5",
          600: "#2279AC",
          700: "#1B6491",
          900: "#0D3A56",
        },
        // SolutionScape teal (matches logo right/bottom gradient)
        teal: {
          50:  "#E8F8F5",
          100: "#C2EDE5",
          200: "#85DBCB",
          400: "#3EC5A9",
          500: "#2EB598",
          600: "#249C81",
          700: "#1C806A",
        },
      },
    },
  },
  plugins: [],
};

export default config;
