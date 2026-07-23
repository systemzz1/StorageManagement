import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

const THEME_KEY = 'themeMode';
const MODES = ['system', 'dark', 'light'];
const ICONS = ['system', 'dark', 'light']; // matches MODES

const getStoredMode = () => {
  const stored = localStorage.getItem(THEME_KEY);
  if (MODES.includes(stored)) return stored;
  return 'system';
};

const applyTheme = (mode) => {
  const isDark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
};

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(getStoredMode);

  useEffect(() => {
    applyTheme(mode);
    localStorage.setItem(THEME_KEY, mode);

    if (mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [mode]);

  const cycleMode = useCallback(() => {
    setMode(prev => {
      const idx = MODES.indexOf(prev);
      return MODES[(idx + 1) % MODES.length];
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, cycleMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
