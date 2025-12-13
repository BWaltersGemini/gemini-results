export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gemini-red': '#af1d22',
        'gemini-blue': '#00aef0',
        'gemini-white': '#ffffff',
        'gemini-light-gray': '#f9f9f9',
        'gemini-medium-gray': '#6b7280',
        'gemini-dark-gray': '#111827',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Optional
      },
    },
  },
  plugins: [],
};