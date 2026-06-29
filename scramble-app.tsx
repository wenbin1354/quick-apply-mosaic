"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { processImage, type ScrambleMethod } from "@/lib/scramble"
import { type Locale } from "@/lib/locale"
import JSZip from "jszip"
import {
  Upload,
  Trash2,
  SlidersHorizontal,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react"

interface ScrambleImage {
  id: string
  file: File
  originalUrl: string
  processedUrl?: string
  status: "pending" | "processing" | "completed" | "error"
}

const translations = {
  zh: {
    language: "语言",
    languageZh: "简体中文",
    languageEn: "English",
    controls: "控制面板",
    uploadImages: "上传图片",
    chooseImages: "选择图片",
    uploadHint: "可多选，支持拖拽上传",
    key: "密钥",
    keyPlaceholder: "小番茄默认1，其他方法输入任意字符串",
    method: "混淆方法",
    methodTomato: "小番茄",
    methodBlock: "块混淆",
    methodRow: "行混淆",
    methodPixel: "逐像素",
    direction: "操作方向",
    encrypt: "混淆",
    decrypt: "解混淆",
    blockCountX: "水平块数",
    blockCountY: "垂直块数",
    processAll: "处理",
    downloadAll: "下载",
    clearAll: "清空全部",
    processing: "处理中...",
    dropImagesHere: "把图片拖到这里！",
    uploadToStart: "上传图片开始使用",
    dragAndDropHint: "可从任意位置拖拽图片，或点击上传按钮",
    dropToUpload: "松开以上传图片",
    downloadPrefix: "下载文件名前缀",
    quickUpload: "上传",
    quickProcess: "处理",
    quickDownload: "下载",
    keyRequired: "请输入密钥后才能处理",
    progress: (completed: number, total: number) => `${completed}/${total} 已完成`,
    keyHint: "上传图片并输入密钥后开始处理",
  },
  en: {
    language: "Language",
    languageZh: "简体中文",
    languageEn: "English",
    controls: "Controls",
    uploadImages: "Upload Images",
    chooseImages: "Choose Images",
    uploadHint: "Multiple selection supported, drag and drop available",
    key: "Key",
    keyPlaceholder: "Tomato default 1, others use any string",
    method: "Method",
    methodTomato: "Tomato",
    methodBlock: "Block",
    methodRow: "Row",
    methodPixel: "Pixel",
    direction: "Direction",
    encrypt: "Scramble",
    decrypt: "Unscramble",
    blockCountX: "Horizontal Blocks",
    blockCountY: "Vertical Blocks",
    processAll: "Process",
    downloadAll: "Download",
    clearAll: "Clear All",
    processing: "Processing...",
    dropImagesHere: "Drop images here!",
    uploadToStart: "Upload images to get started",
    dragAndDropHint: "Drag and drop images here, or use the upload button",
    dropToUpload: "Drop images here to upload",
    downloadPrefix: "Download Filename Prefix",
    quickUpload: "Upload",
    quickProcess: "Process",
    quickDownload: "Download",
    keyRequired: "Enter a key to enable processing",
    progress: (completed: number, total: number) => `${completed}/${total} completed`,
    keyHint: "Upload images and enter a key to start",
  },
} as const

export default function ScrambleApp({ locale, onLocaleChange }: { locale: Locale; onLocaleChange: (l: Locale) => void }) {
  const t = translations[locale]

  const [images, setImages] = useState<ScrambleImage[]>([])
  const [key, setKey] = useState("1")
  const [method, setMethod] = useState<ScrambleMethod>("tomato")
  const [direction, setDirection] = useState<"encrypt" | "decrypt">("encrypt")
  const [blockCountX, setBlockCountX] = useState(32)
  const [blockCountY, setBlockCountY] = useState(32)
  const [prefix, setPrefix] = useState("scrambled")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isMobileControlPanelOpen, setIsMobileControlPanelOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imagesRef = useRef<ScrambleImage[]>(images)
  imagesRef.current = images

  const processingGenRef = useRef(0)

  useEffect(() => {
    processingGenRef.current++
    setImages((prev) =>
      prev.map((img) => {
        if (img.status === "completed" || img.status === "processing") {
          if (img.processedUrl) URL.revokeObjectURL(img.processedUrl)
          return { ...img, status: "pending" as const, processedUrl: undefined }
        }
        return img
      })
    )
  }, [key, method, direction, blockCountX, blockCountY])

  const addImages = useCallback((files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"))
    const newImages: ScrambleImage[] = imageFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      originalUrl: URL.createObjectURL(file),
      status: "pending" as const,
    }))
    setImages((prev) => [...prev, ...newImages])
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) addImages(e.target.files)
      e.target.value = ""
    },
    [addImages]
  )

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id)
      if (img) {
        URL.revokeObjectURL(img.originalUrl)
        if (img.processedUrl) URL.revokeObjectURL(img.processedUrl)
      }
      return prev.filter((i) => i.id !== id)
    })
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      if (e.dataTransfer.files) addImages(e.dataTransfer.files)
    },
    [addImages]
  )

  const processAllImages = useCallback(async () => {
    const currentImages = imagesRef.current
    if (!key.trim() || currentImages.length === 0) return
    setIsProcessing(true)
    const gen = processingGenRef.current

    for (let i = 0; i < currentImages.length; i++) {
      if (currentImages[i].status === "completed") continue
      const imgId = currentImages[i].id
      setImages((prev) =>
        prev.map((img) => (img.id === imgId ? { ...img, status: "processing" } : img))
      )

      try {
        const img = currentImages[i]
        const htmlImg = new Image()
        htmlImg.crossOrigin = "anonymous"
        await new Promise<void>((resolve, reject) => {
          htmlImg.onload = () => resolve()
          htmlImg.onerror = () => reject(new Error("Failed to load image"))
          htmlImg.src = img.originalUrl
        })

        const canvas = document.createElement("canvas")
        canvas.width = htmlImg.naturalWidth
        canvas.height = htmlImg.naturalHeight
        const ctx = canvas.getContext("2d")!
        ctx.drawImage(htmlImg, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        const result = processImage(imageData, {
          key: key.trim(),
          method,
          direction,
          blockCountX,
          blockCountY,
        })

        const outCanvas = document.createElement("canvas")
        outCanvas.width = result.width
        outCanvas.height = result.height
        const outCtx = outCanvas.getContext("2d")!
        outCtx.putImageData(result, 0, 0)

        const blob = await new Promise<Blob>((resolve) =>
          outCanvas.toBlob((b) => resolve(b!), "image/png")
        )
        const processedUrl = URL.createObjectURL(blob)

        if (processingGenRef.current !== gen) {
          URL.revokeObjectURL(processedUrl)
          break
        }

        setImages((prev) =>
          prev.map((img) =>
            img.id === imgId ? { ...img, processedUrl, status: "completed" } : img
          )
        )
      } catch {
        if (processingGenRef.current !== gen) break
        setImages((prev) =>
          prev.map((img) => (img.id === imgId ? { ...img, status: "error" } : img))
        )
      }
    }

    setIsProcessing(false)
  }, [key, method, direction, blockCountX, blockCountY])

  const downloadAll = useCallback(async () => {
    const completedImages = images.filter((img) => img.processedUrl)
    if (completedImages.length === 0) return
    setIsDownloading(true)

    try {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

    if (isMobile) {
      const zip = new JSZip()
      for (let i = 0; i < completedImages.length; i++) {
        const img = completedImages[i]
        const response = await fetch(img.processedUrl!)
        const blob = await response.blob()
        zip.file(`${prefix}_${String(i + 1).padStart(3, "0")}.png`, blob)
      }
      const zipBlob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${prefix}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      for (let i = 0; i < completedImages.length; i++) {
        const img = completedImages[i]
        const a = document.createElement("a")
        a.href = img.processedUrl!
        a.download = `${prefix}_${String(i + 1).padStart(3, "0")}.png`
        a.click()
        await new Promise((r) => setTimeout(r, 300))
      }
    }
    } finally {
      setIsDownloading(false)
    }
  }, [images, prefix])

  const clearAll = useCallback(() => {
    if (images.length > 0 && !window.confirm(locale === "zh" ? "确定要清空全部图片吗？" : "Clear all images? This cannot be undone.")) return
    images.forEach((img) => {
      URL.revokeObjectURL(img.originalUrl)
      if (img.processedUrl) URL.revokeObjectURL(img.processedUrl)
    })
    setImages([])
  }, [images, locale])

  const completedCount = images.filter((img) => img.status === "completed").length
  const hasImages = images.length > 0

  return (
    <div
      className={`min-h-screen p-4 pb-24 md:pb-4 transition-colors duration-200 ${
        isDragOver ? "bg-blue-100 border-4 border-dashed border-blue-400" : "bg-gray-50"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="max-w-7xl mx-auto md:max-w-none md:mx-5">
        {/* Desktop: sidebar + content grid (matches Mosaic) */}
        <div className="hidden md:grid md:grid-cols-[270px_minmax(0,1fr)] gap-4 items-start">
          <aside className="sticky top-3 max-h-[calc(100vh-1.5rem)] overflow-y-auto pl-1 pr-2 py-1 space-y-4 text-foreground">
            <div className="space-y-1">
              <p className="text-sm font-semibold">{t.controls}</p>
            </div>

            {/* Language */}
            <div className="space-y-2">
              <Label>{t.language}</Label>
              <select
                value={locale}
                onChange={(e) => onLocaleChange(e.target.value as Locale)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="zh">{t.languageZh}</option>
                <option value="en">{t.languageEn}</option>
              </select>
            </div>

            {/* Key (most important — first after language) */}
            <div className="space-y-2">
              <Label>{t.key}</Label>
              <Input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={t.keyPlaceholder}
              />
              {!key.trim() && hasImages && (
                <p className="text-xs text-amber-600">{t.keyRequired}</p>
              )}
            </div>

            {/* Upload */}
            <div className="space-y-2">
              <Label>{t.uploadImages}</Label>
              <Input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                ref={fileInputRef}
                className="cursor-pointer"
              />
            </div>

            {/* Download Prefix */}
            <div className="space-y-2">
              <Label>{t.downloadPrefix}</Label>
              <Input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="scrambled"
              />
            </div>

            {/* Direction */}
            <div className="space-y-2">
              <Label>{t.direction}</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={direction === "encrypt" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDirection("encrypt")}
                  className={`text-xs ${direction !== "encrypt" ? "bg-transparent" : ""}`}
                >
                  {t.encrypt}
                </Button>
                <Button
                  type="button"
                  variant={direction === "decrypt" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDirection("decrypt")}
                  className={`text-xs ${direction !== "decrypt" ? "bg-transparent" : ""}`}
                >
                  {t.decrypt}
                </Button>
              </div>
            </div>

            {/* Method */}
            <div className="space-y-2">
              <Label>{t.method}</Label>
              <div className="grid grid-cols-4 gap-1">
                {(["tomato", "block", "row", "pixel"] as ScrambleMethod[]).map((m) => (
                  <Button
                    key={m}
                    type="button"
                    variant={method === m ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMethod(m)}
                    className={`text-xs ${method !== m ? "bg-transparent" : ""}`}
                  >
                    {m === "tomato" ? t.methodTomato : m === "block" ? t.methodBlock : m === "row" ? t.methodRow : t.methodPixel}
                  </Button>
                ))}
              </div>
            </div>

            {/* Block count sliders (only for block method) */}
            {method === "block" && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span>{t.blockCountX}</span>
                    <span>{blockCountX}</span>
                  </div>
                  <Slider value={[blockCountX]} onValueChange={([v]) => setBlockCountX(v)} min={2} max={64} step={1} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span>{t.blockCountY}</span>
                    <span>{blockCountY}</span>
                  </div>
                  <Slider value={[blockCountY]} onValueChange={([v]) => setBlockCountY(v)} min={2} max={64} step={1} />
                </div>
              </>
            )}

            {/* Action buttons row (matches Mosaic grid-cols-3) */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                size="sm"
                onClick={processAllImages}
                disabled={!hasImages || isProcessing || !key.trim()}
                className="text-xs"
              >
                {t.processAll}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={downloadAll}
                disabled={completedCount === 0 || isDownloading}
                className="text-xs bg-transparent"
              >
                {t.downloadAll}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={clearAll}
                disabled={images.length === 0}
                className="text-xs bg-transparent"
              >
                {t.clearAll}
              </Button>
            </div>

            {/* Progress */}
            {hasImages && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{t.progress(completedCount, images.length)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${images.length > 0 ? (completedCount / images.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
          </aside>

          {/* Main content area */}
          <div className="space-y-4 min-w-0">
            {images.length === 0 ? (
              <Card
                className={`transition-all duration-200 cursor-pointer ${isDragOver ? "border-blue-400 bg-blue-50" : ""}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <CardContent className="text-center py-12">
                  <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragOver ? "text-blue-500" : "text-gray-400"}`} />
                  <p className={`text-lg font-medium mb-2 ${isDragOver ? "text-blue-700" : "text-gray-700"}`}>
                    {isDragOver ? t.dropImagesHere : t.uploadToStart}
                  </p>
                  <p className="text-sm text-gray-400 mt-2">{t.dragAndDropHint}</p>
                  <p className="text-xs text-gray-400 mt-1">{t.keyHint}</p>
                  <Button
                    type="button"
                    className="mt-4"
                    onClick={(event) => {
                      event.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {t.chooseImages}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {images.map((img) => (
                  <Card key={img.id} className={`overflow-hidden ${img.status === "completed" ? "border-l-4 border-l-green-500" : img.status === "error" ? "border-l-4 border-l-red-500" : ""}`}>
                    <CardContent className="p-2">
                      <div className="relative">
                        <img
                          src={img.processedUrl || img.originalUrl}
                          alt=""
                          className="w-full h-48 object-contain bg-muted rounded"
                        />
                        {img.status === "processing" && (
                          <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                          </div>
                        )}
                        <button
                          onClick={() => removeImage(img.id)}
                          className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <div className="absolute top-1 right-1">
                          {img.status === "completed" && (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          )}
                          {img.status === "error" && (
                            <AlertCircle className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {img.file.name}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile: images list */}
        <div className="grid grid-cols-1 md:hidden gap-4 mb-24">
          {images.map((img) => (
            <Card key={img.id} className="overflow-hidden">
              <CardContent className="p-2">
                <div className="relative">
                  <img
                    src={img.processedUrl || img.originalUrl}
                    alt=""
                    className="w-full h-40 object-contain bg-muted rounded"
                  />
                  <button
                    onClick={() => removeImage(img.id)}
                    className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="absolute top-1 right-1">
                    {img.status === "completed" && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    {img.status === "processing" && (
                      <Clock className="w-5 h-5 text-yellow-500 animate-spin" />
                    )}
                    {img.status === "error" && (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {img.file.name}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Mobile: empty state */}
        {images.length === 0 && (
          <Card
            className={`md:hidden transition-all duration-200 cursor-pointer ${isDragOver ? "border-blue-400 bg-blue-50" : ""}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <CardContent className="text-center py-12">
              <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragOver ? "text-blue-500" : "text-gray-400"}`} />
              <p className={`text-lg font-medium mb-2 ${isDragOver ? "text-blue-700" : "text-gray-700"}`}>
                {isDragOver ? t.dropImagesHere : t.uploadToStart}
              </p>
              <p className="text-sm text-gray-400 mt-2">{t.dragAndDropHint}</p>
              <Button
                type="button"
                className="mt-4"
                onClick={(event) => {
                  event.stopPropagation()
                  fileInputRef.current?.click()
                }}
              >
                <Upload className="w-4 h-4 mr-2" />
                {t.chooseImages}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Drag overlay */}
        {isDragOver && (
          <div className="fixed inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-white rounded-lg p-8 shadow-lg border-2 border-blue-400 border-dashed">
              <Upload className="w-16 h-16 mx-auto mb-4 text-blue-500" />
              <p className="text-xl font-semibold text-blue-700">{t.dropToUpload}</p>
            </div>
          </div>
        )}

        {/* Mobile: bottom action bar */}
        <div className="md:hidden fixed bottom-3 inset-x-3 z-40 rounded-xl border border-gray-200 bg-white/95 backdrop-blur px-3 py-2 shadow-lg">
          {isProcessing && hasImages && (
            <div className="mb-2">
              <div className="flex justify-between text-[11px] text-gray-600 mb-1">
                <span className="truncate">{t.progress(completedCount, images.length)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${images.length > 0 ? (completedCount / images.length) * 100 : 0}%` }} />
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()} className="text-xs min-w-0">
              <span className="truncate">{t.quickUpload}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={processAllImages}
              disabled={!hasImages || isProcessing || !key.trim()}
              className="text-xs min-w-0"
            >
              <span className="truncate">{t.quickProcess}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={downloadAll}
              disabled={completedCount === 0 || isDownloading}
              className="text-xs min-w-0 bg-transparent"
            >
              <span className="truncate">{t.quickDownload}</span>
            </Button>
          </div>
        </div>

        {/* Mobile: floating controls button */}
        <div className="md:hidden fixed bottom-24 right-4 z-40">
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => setIsMobileControlPanelOpen(true)}
            className="h-12 w-12 rounded-full bg-white shadow-lg"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </Button>
        </div>

        {/* Mobile: slide-up control panel */}
        {isMobileControlPanelOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setIsMobileControlPanelOpen(false)}>
            <div
              className="absolute left-0 right-0 bottom-0 rounded-t-2xl bg-white max-h-[85vh] overflow-y-auto px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">{t.controls}</h3>
                <Button type="button" size="icon" variant="ghost" onClick={() => setIsMobileControlPanelOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>{t.language}</Label>
                  <select
                    value={locale}
                    onChange={(e) => onLocaleChange(e.target.value as Locale)}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  >
                    <option value="zh">{t.languageZh}</option>
                    <option value="en">{t.languageEn}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>{t.key}</Label>
                  <Input type="text" value={key} onChange={(e) => setKey(e.target.value)} placeholder={t.keyPlaceholder} />
                </div>

                <div className="space-y-1.5">
                  <Label>{t.direction}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={direction === "encrypt" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDirection("encrypt")}
                      className={`text-xs ${direction !== "encrypt" ? "bg-transparent" : ""}`}
                    >
                      {t.encrypt}
                    </Button>
                    <Button
                      type="button"
                      variant={direction === "decrypt" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDirection("decrypt")}
                      className={`text-xs ${direction !== "decrypt" ? "bg-transparent" : ""}`}
                    >
                      {t.decrypt}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>{t.method}</Label>
                  <div className="grid grid-cols-4 gap-1">
                    {(["tomato", "block", "row", "pixel"] as ScrambleMethod[]).map((m) => (
                      <Button
                        key={m}
                        type="button"
                        variant={method === m ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMethod(m)}
                        className={`text-xs ${method !== m ? "bg-transparent" : ""}`}
                      >
                        {m === "tomato" ? t.methodTomato : m === "block" ? t.methodBlock : m === "row" ? t.methodRow : t.methodPixel}
                      </Button>
                    ))}
                  </div>
                </div>

                {method === "block" && (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span>{t.blockCountX}</span>
                        <span>{blockCountX}</span>
                      </div>
                      <Slider value={[blockCountX]} onValueChange={([v]) => setBlockCountX(v)} min={2} max={64} step={1} />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span>{t.blockCountY}</span>
                        <span>{blockCountY}</span>
                      </div>
                      <Slider value={[blockCountY]} onValueChange={([v]) => setBlockCountY(v)} min={2} max={64} step={1} />
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <Label>{t.downloadPrefix}</Label>
                  <Input type="text" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="scrambled" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { clearAll(); setIsMobileControlPanelOpen(false) }}
                  disabled={images.length === 0}
                  className="w-full"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t.clearAll}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
