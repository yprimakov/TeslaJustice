/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        'tesla-red': '#E82127',
        'tesla-gray': '#393C41',
        'tesla-blue': '#3E6AE1'
      }
    }
  },
  plugins: []
};
