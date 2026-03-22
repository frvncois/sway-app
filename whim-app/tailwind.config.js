/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-base': '#0C0B0A',
        'bg-card': '#111009',
        'bg-elevated': '#1A1816',
        'border-subtle': '#2A2820',
        amber: '#E8935A',
        blue: '#6B8EFF',
        purple: '#B06BFF',
        green: '#7BC67E',
        'text-primary': 'rgba(255,255,255,0.9)',
        'text-secondary': 'rgba(255,255,255,0.45)',
        'text-muted': 'rgba(255,255,255,0.22)',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        ui: ['DM Sans', 'sans-serif'],
      },
      borderRadius: {
        card: '20px',
        sheet: '26px',
        pill: '100px',
        btn: '16px',
      },
    },
  },
  plugins: [],
}
