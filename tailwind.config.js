/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}", // Covers everything inside src
    "./app/**/*.{js,ts,jsx,tsx,mdx}", // Backup if you aren't using src
    "./components/**/*.{js,ts,jsx,tsx,mdx}", // Backup for components
    "./pages/**/*.{js,ts,jsx,tsx,mdx}", // Backup for pages
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)'],
        mono: ['var(--font-mono)'],
        chakra: ['var(--font-chakra)'],
      },
    },
  },
  plugins: [],
};