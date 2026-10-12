import React, { createContext, useContext, useState, useEffect } from 'react';
import { Palette } from '../types';
import i18n, { isRtlLanguage, SupportedLanguage } from '../i18n/config';
import { hexToRgbChannels } from '../lib/colorChannels';

/**
 * What the dashboard looks like before (or without) a webConfig — Lightor's
 * own brand colours, the same violet the register app uses. Value-identical
 * to what first paint always showed; what changed (LT-021) is the source:
 * these used to be read off MOCK_WEB_CONFIG, a fabricated business record,
 * which made the dashboard's default chrome depend on dummy data.
 */
const DEFAULT_PALETTE: Palette = {
  colorPrimary: '#8b5cf6',
  colorPrimaryDark: '#7c3aed',
  colorLightBg: '#ffffff',
  colorLightSurface: '#ffffff',
  colorLightGray: '#64748b',
  colorLightText: '#1f2937',
  colorDarkBg: '#1e293b',
  colorDarkSurface: '#334155',
  colorDarkGray: '#9ca3af',
  colorDarkText: '#f9fafb',
};

interface ThemeContextProps {
  palette: Palette;
  updatePalette: (newPalette: Palette) => void;
  direction: 'rtl' | 'ltr';
  language: string;
  darkMode: boolean;
  toggleDirection: () => void;
  toggleDarkMode: () => void;
  changeLanguage: (lang: SupportedLanguage) => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);
  const [direction, setDirection] = useState<'rtl' | 'ltr'>(
    isRtlLanguage(i18n.language) ? 'rtl' : 'ltr'
  );
  const [language, setLanguage] = useState(i18n.language);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const savedMode = localStorage.getItem('darkMode');
    return savedMode ? JSON.parse(savedMode) : false;
  });

  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      setLanguage(lng);
      setDirection(isRtlLanguage(lng) ? 'rtl' : 'ltr');
    };

    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  useEffect(() => {
    // Apply theme to CSS variables. Each colour also gets an `-rgb` twin with
    // its bare channels ("139 92 246"): tailwind.config.js builds `primary`
    // from those so opacity modifiers like bg-primary/10 work (LT-280), and
    // a colour must never change without its channels.
    Object.entries(palette).forEach(([key, value]) => {
      const name = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      document.documentElement.style.setProperty(name, value);
      const channels = hexToRgbChannels(value);
      if (channels) document.documentElement.style.setProperty(`${name}-rgb`, channels);
      else console.warn(`ThemeContext: ${key} "${value}" is not a hex colour; ${name}-rgb left as it was`);
    });

    // Apply direction + language to HTML (lang helps font selection & a11y)
    document.documentElement.setAttribute('dir', direction);
    document.documentElement.setAttribute('lang', language);
    document.documentElement.classList.toggle('rtl', direction === 'rtl');
    
    // Apply dark mode
    document.documentElement.classList.toggle('dark', darkMode);
  }, [palette, direction, darkMode, language]);

  const updatePalette = (newPalette: Palette) => {
    setPalette(newPalette);
  };

  const changeLanguage = (lang: SupportedLanguage) => {
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