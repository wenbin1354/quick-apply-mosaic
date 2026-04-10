export type Locale = "zh" | "en"

export const resolveInitialLocale = (savedLocale: string | null, browserLanguage: string): Locale => {
  if (savedLocale === "zh" || savedLocale === "en") {
    return savedLocale
  }

  return browserLanguage.toLowerCase().startsWith("zh") ? "zh" : "en"
}

export const localeToHtmlLang = (locale: Locale): string => (locale === "zh" ? "zh-CN" : "en")
