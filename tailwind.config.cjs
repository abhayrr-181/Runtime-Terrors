module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx,mdx}",
    "./components/**/*.{js,jsx,ts,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '0.2' },
          '50%': { opacity: '1' }
        }
      },
      animation: {
        pulseDot: 'pulseDot 1s ease-in-out infinite'
      }
    }
  },
  plugins: []
};
