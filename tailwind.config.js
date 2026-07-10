/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/views/**/*.ejs',
    './src/public/js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        // `brand` colors come from CSS variables (--brand-50 … --brand-950)
        // emitted by layouts/main.ejs based on the Appearance Settings'
        // primary color picker. This lets admins recolor the entire app
        // without rebuilding CSS. Each shade falls back to a hardcoded
        // value if the variable is missing (e.g. during compile-time).
        brand: {
          50:  'var(--brand-50,  #eef6ff)',
          100: 'var(--brand-100, #d9eaff)',
          200: 'var(--brand-200, #bcdaff)',
          300: 'var(--brand-300, #8ec3ff)',
          400: 'var(--brand-400, #59a1ff)',
          500: 'var(--brand-500, #3380fc)',
          600: 'var(--brand-600, #1d61f2)',
          700: 'var(--brand-700, #164bdc)',
          800: 'var(--brand-800, #193eb2)',
          900: 'var(--brand-900, #1a388c)',
          950: 'var(--brand-950, #152456)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
