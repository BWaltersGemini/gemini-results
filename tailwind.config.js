// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // NEW BRAND PALETTE – December 2025 Rebrand
        'brand-red': '#B22222',           // Primary – bold, energetic (buttons, accents)
        'brand-turquoise': '#48D1CC',     // Accent – fresh, modern (secondary buttons, links)
        'brand-light': '#F0F8FF',          // Backgrounds, cards, subtle sections
        'brand-dark': '#263238',           // Text, headers, footers

        // Semantic aliases – use these for clarity in components
        primary: '#B22222',
        accent: '#48D1CC',
        'bg-light': '#F0F8FF',
        'text-dark': '#263238',
        'text-light': '#ffffff',
        'text-muted': '#666666',

        // Legacy support (optional – you can remove later)
        // 'gemini-red': '#af1d22',        // Old – kept temporarily if needed
        // 'gemini-blue': '#00aef0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};