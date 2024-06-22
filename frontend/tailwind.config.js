
module.exports = {
  darkMode: 'selector',
  content: [
    './src/renderer/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary-color)',
        secondary: 'var(--secondary-color)',
        background: 'var(--background-color)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        accent: 'var(--accent-color)',
        success: 'var(--success-color)',
        error: 'var(--error-color)',
        warning: 'var(--warning-color)',
        themeblack: 'var(--themeblack)',
        themewhite: 'var(--themewhite)',
      }
    }
  },
  variants: {},
  plugins: [],
};


