import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { languages, translations, SupportedLanguage } from '@/locales/translations';

const STORAGE_KEY = 'app_language';

type TranslationValues = Record<string, string | number>;

interface I18nContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  t: (key: keyof typeof translations['fr'], values?: TranslationValues) => string;
  availableLanguages: Array<{ code: SupportedLanguage; label: string }>;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>('fr');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored && (stored === 'fr' || stored === 'en' || stored === 'es' || stored === 'pt')) {
          setLanguageState(stored);
        }
      } catch (error) {
        console.error('❌ Erreur chargement langue:', error);
      } finally {
        setIsReady(true);
      }
    };

    loadLanguage();
  }, []);

  const persistLanguage = async (lang: SupportedLanguage) => {
    setLanguageState(lang);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, lang);
    } catch (error) {
      console.error('❌ Erreur sauvegarde langue:', error);
    }
  };

  const translate = (key: keyof typeof translations['fr'], values?: TranslationValues) => {
    const table = translations[language] || translations.fr;
    let template = table[key] ?? translations.fr[key] ?? key;

    if (values) {
      Object.keys(values).forEach((valueKey) => {
        const value = values[valueKey];
        template = template.replace(`{{${valueKey}}}`, String(value));
      });
    }

    return template;
  };

  const contextValue = useMemo<I18nContextValue>(() => ({
    language,
    setLanguage: persistLanguage,
    t: translate,
    availableLanguages: (Object.keys(languages) as SupportedLanguage[]).map(code => ({
      code,
      label: languages[code].label
    }))
  }), [language]);

  if (!isReady) {
    return null;
  }

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within I18nProvider');
  }
  return context;
};
