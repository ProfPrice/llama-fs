import React from 'react';
import { useTheme } from './ThemeContext';

const ThemeSwitcher = () => {
  const { theme, setTheme } = useTheme();

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTheme(e.target.value);
  };

  return (
    <select value={theme} onChange={handleThemeChange} style={{ display: 'none' }}> {/* You can hide or style it based on your UI */}
      <option value="dark">Dark</option>
      <option value="light">Light</option>
      <option value="pink">Pink</option>
    </select>
  );
};

export default ThemeSwitcher;
