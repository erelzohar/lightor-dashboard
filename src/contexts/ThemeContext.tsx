import React, { createContext, useContext, useState, useEffect } from 'react';
import { Palette } from '../types';
import { MOCK_WEB_CONFIG } from '../utils/mockData';
import i18n from '../i18n/config';

interface ThemeContextProps {
  palette: Palette;
  updatePalette: (newPalette: Palette) => void;
  direction: 'rtl' | 'ltr';
  language: string;
  darkMode: boolean;
  toggleDirection: () => void;
  toggleDarkMode: () => void;
  changeLanguage: (lang: 'he' | 'en') => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ⚠️ DUMMY DATA (LT-021) — first paint uses the mock brand palette, not the
  // owner's, until the real webConfig loads and calls updatePalette.
  const [palette, setPalette] = useState<Palette>(MOCK_WEB_CONFIG.pallete);
  const [direction, setDirection] = useState<'rtl' | 'ltr'>(
    i18n.language === 'he' ? 'rtl' : 'ltr'
  );
  const [language, setLanguage] = useState(i18n.language);
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode');
    return savedMode ? JSON.parse(savedMode) : false;
  });

  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      setLanguage(lng);
      const newDir = lng === 'he' ? 'rtl' : 'ltr';
      setDirection(newDir);
    };

    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

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

  const changeLanguage = (lang: 'he' | 'en') => {
    i18n.changeLanguage(lang);
  };

  const toggleDirection = () => {
    const newLang = i18n.language === 'he' ? 'en' : 'he';
    changeLanguage(newLang);
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
      toggleDarkMode,
      changeLanguage
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