import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['tr', 'en', 'de', 'fr', 'ru'],
  defaultLocale: 'tr',
  localePrefix: 'as-needed',
})
