"use client"

import { useState, useEffect, useCallback } from "react"
import MosaicFilterApp from "../app"
import ScrambleApp from "../scramble-app"
import { resolveInitialLocale, type Locale } from "@/lib/locale"

export default function Page() {
  const [mode, setMode] = useState<"mosaic" | "scramble">("mosaic")
  const [locale, setLocale] = useState<Locale>("en")

  useEffect(() => {
    const saved = window.localStorage.getItem("mosaic-locale")
    setLocale(resolveInitialLocale(saved, window.navigator.language))
  }, [])

  const handleLocaleChange = useCallback((newLocale: Locale) => {
    setLocale(newLocale)
    window.localStorage.setItem("mosaic-locale", newLocale)
  }, [])

  const labels = {
    zh: { mosaic: "马赛克", scramble: "混淆" },
    en: { mosaic: "Mosaic", scramble: "Scramble" },
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Tab switcher */}
      <div className="sticky top-0 z-50 bg-card border-b">
        <div className="flex items-center justify-center gap-1 p-2">
          <button
            onClick={() => setMode("mosaic")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === "mosaic"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {labels[locale].mosaic}
          </button>
          <button
            onClick={() => setMode("scramble")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === "scramble"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {labels[locale].scramble}
          </button>
        </div>
      </div>

      {/* Content — both mounted, toggle visibility to preserve state */}
      <div className={mode === "mosaic" ? "" : "hidden"}>
        <MosaicFilterApp locale={locale} onLocaleChange={handleLocaleChange} />
      </div>
      <div className={mode === "scramble" ? "" : "hidden"}>
        <ScrambleApp locale={locale} onLocaleChange={handleLocaleChange} />
      </div>
    </div>
  )
}
