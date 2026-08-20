import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // Item C: the portals must ALWAYS open in light mode, on web and inside the
  // Android/iOS shells. The OS `prefers-color-scheme` hint is deliberately
  // ignored - only an explicit choice the user made with the toggle is honoured.
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('rsa_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rsa_theme', theme);
  }, [theme]);

  const toggleTheme = () => setThemeState((t) => (t === 'light' ? 'dark' : 'light'));

  return <ThemeContext.Provider value={{ theme, setTheme: setThemeState, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
