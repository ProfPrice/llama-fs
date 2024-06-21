import React, { createContext, useContext, useState, useEffect } from 'react';

const defaultTheme = 'dark'; // Set default theme
const ThemeContext = createContext({
  theme: defaultTheme,
  setTheme: (theme: string) => {}
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || defaultTheme);

  useEffect(() => {
    document.body.classList.remove('dark', 'light', 'pink');
    document.body.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
