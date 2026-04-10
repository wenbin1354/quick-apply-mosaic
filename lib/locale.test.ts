import { describe, expect, it } from "vitest"

import { localeToHtmlLang, resolveInitialLocale } from "@/lib/locale"

describe("resolveInitialLocale", () => {
  it("uses saved locale when valid", () => {
    expect(resolveInitialLocale("zh", "en-US")).toBe("zh")
    expect(resolveInitialLocale("en", "zh-CN")).toBe("en")
  })

  it("falls back to browser language when saved value is missing", () => {
    expect(resolveInitialLocale(null, "zh-CN")).toBe("zh")
    expect(resolveInitialLocale(null, "en-US")).toBe("en")
  })

  it("falls back to browser language when saved value is invalid", () => {
    expect(resolveInitialLocale("fr", "zh-TW")).toBe("zh")
    expect(resolveInitialLocale("fr", "ja-JP")).toBe("en")
  })
})

describe("localeToHtmlLang", () => {
  it("maps locale to html lang", () => {
    expect(localeToHtmlLang("zh")).toBe("zh-CN")
    expect(localeToHtmlLang("en")).toBe("en")
  })
})
