const c = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: c('bg'),
        panel: c('panel'),
        soft: c('soft'),
        line: c('line'),
        ink: c('ink'),
        mute: c('mute'),
        brand: c('brand'),
        deep: c('deep'),
        cream: c('cream'),
        cow: c('cow'),
        buffalo: c('buffalo'),
        goat: c('goat'),
        danger: c('danger'),
        ok: c('ok'),
        warn: c('warn'),
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        lift: '0 1px 0 rgb(var(--line) / .6), 0 12px 32px -16px rgb(var(--deep) / .28)',
        pop: '0 24px 60px -20px rgb(var(--deep) / .45)',
      },
      keyframes: {
        wave: { to: { transform: 'translateX(-90px)' } },
        drift: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        ring: { '0%': { transform: 'scale(.6)', opacity: '.7' }, '100%': { transform: 'scale(2.2)', opacity: '0' } },
        shimmer: { to: { backgroundPosition: '-200% 0' } },
        drop: { '0%': { transform: 'translateY(-14px) scale(.6)', opacity: '0' }, '40%': { opacity: '1' }, '100%': { transform: 'translateY(16px) scale(1)', opacity: '0' } },
      },
      animation: {
        wave: 'wave 5s linear infinite',
        'wave-slow': 'wave 9s linear infinite reverse',
        drift: 'drift 6s ease-in-out infinite',
        ring: 'ring 2s ease-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
        drop: 'drop 1.8s ease-in infinite',
      },
    },
  },
  plugins: [],
};
