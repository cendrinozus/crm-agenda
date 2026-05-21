import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en'
import fr from './fr'

const savedLang = localStorage.getItem('lang') || 'en'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    lng: savedLang,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('lang', lng)
})

export default i18n
