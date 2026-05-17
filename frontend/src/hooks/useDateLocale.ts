import { useTranslation } from 'react-i18next'
import { fr, enUS } from 'date-fns/locale'

export function useDateLocale() {
  const { i18n } = useTranslation()
  return i18n.language === 'fr' ? fr : enUS
}
