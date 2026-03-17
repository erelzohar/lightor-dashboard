import React, { createContext, useContext, useState, useEffect } from 'react';
import { Palette } from '../types';
import { MOCK_WEB_CONFIG } from '../utils/mockData';

interface ThemeContextProps {
  palette: Palette;
  updatePalette: (newPalette: Palette) => void;
  direction: 'rtl' | 'ltr';
  language: 'he' | 'en';
  darkMode: boolean;
  toggleDirection: () => void;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [palette, setPalette] = useState<Palette>(MOCK_WEB_CONFIG.pallete);
  const [direction, setDirection] = useState<'rtl' | 'ltr'>(
    MOCK_WEB_CONFIG.defaultLanguage === 'he' ? 'rtl' : 'ltr'
  );
  const [language, setLanguage] = useState<'he' | 'en'>(
    MOCK_WEB_CONFIG.defaultLanguage === 'he' ? 'he' : 'en'
  );
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode');
    return savedMode ? JSON.parse(savedMode) : false;
  });

  useEffect(() => {
    // Apply theme to CSS variables
    Object.entries(palette).forEach(([key, value]) => {
      document.documentElement.style.setProperty(
        `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`,
        value
      );
    });

    // Apply direction to HTML
    document.documentElement.setAttribute('dir', direction);
    document.documentElement.classList.toggle('rtl', direction === 'rtl');
    
    // Apply dark mode
    document.documentElement.classList.toggle('dark', darkMode);
  }, [palette, direction, darkMode]);

  const updatePalette = (newPalette: Palette) => {
    setPalette(newPalette);
  };

  const toggleDirection = () => {
    const newDirection = direction === 'rtl' ? 'ltr' : 'rtl';
    const newLanguage = newDirection === 'rtl' ? 'he' : 'en';
    
    setDirection(newDirection);
    setLanguage(newLanguage);
  };

  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const newMode = !prev;
      localStorage.setItem('darkMode', JSON.stringify(newMode));
      return newMode;
    });
  };

  return (
    <ThemeContext.Provider value={{ 
      palette, 
      updatePalette, 
      direction, 
      language,
      darkMode,
      toggleDirection,
      toggleDarkMode
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
};