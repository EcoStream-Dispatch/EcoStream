/**
 * Tailwind config.
 * Brand colours come from our logo - see docs/BRAND.md.
 * The same values are also defined as CSS variables in src/styles/index.css,
 * so plain CSS (and charts later) can use them too.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0B1E36', // headings, sidebar, primary text
          700: '#1D323A', // secondary text, borders on dark
        },
        green: {
          700: '#3E7231', // primary buttons, links, active states
          500: '#5C9A35', // accents, "OK" status, charts
          300: '#8CC152', // highlights, hover, leaf tone
          50: '#F4F9F1',  // soft section backgrounds
        },
        warning: '#E0A100',
        critical: '#C62828',
        // Tyre status colours (use these names in components so meaning is clear)
        status: {
          ok: '#5C9A35',
          warning: '#E0A100',
          critical: '#C62828',
          offline: '#9CA3AF',
        },
      },
      fontFamily: {
        heading: ['Montserrat', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
