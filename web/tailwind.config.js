// /** @type {import('tailwindcss').Config} */
// module.exports = {
//   content: ["./src/**/*.{js,jsx,ts,tsx}"],

//   theme: {
//     extend: {
//       colors : {
//         primary : "#f0abfc",
//         secondary : "#c026d3",
//       }
//     },
//   },
//   plugins: [],
// }


/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Purple-based primary palette
        primary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',  // Main primary
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
        },
        // Secondary purple/indigo
        secondary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',  // Main secondary
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a6',
          900: '#312e81',
        },
        // Accent rose/pink for expenses
        accent: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',  // Main accent
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
        },
        // Success for positive balances
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        // Muted slate for backgrounds
        muted: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #7e22ce 0%, #4338ca 100%)',
        'gradient-secondary': 'linear-gradient(135deg, #a5b4fc 0%, #c084fc 100%)',
        'gradient-accent': 'linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)',
        'gradient-success': 'linear-gradient(135deg, #22c55e 0%, #4ade80 100%)',
        'gradient-app': 'linear-gradient(to bottom right, #f8fafc, #e9d5ff)',
        'gradient-card': 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 100%)',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(126, 34, 206, 0.1), 0 10px 20px -2px rgba(126, 34, 206, 0.04)',
        'card': '0 4px 20px -2px rgba(126, 34, 206, 0.08), 0 2px 10px -2px rgba(126, 34, 206, 0.04)',
        'elevated': '0 10px 40px -5px rgba(126, 34, 206, 0.15), 0 4px 15px -3px rgba(126, 34, 206, 0.08)',
        'glow': '0 0 20px rgba(126, 34, 206, 0.3)',
        'glow-accent': '0 0 20px rgba(244, 63, 94, 0.3)',
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      animation: {
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}