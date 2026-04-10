"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { Button } from "@/components/ui/button"

import { Input } from "@/components/ui/input"

import { Label } from "@/components/ui/label"

import { Slider } from "@/components/ui/slider"

import {
  Upload,
  Download,
  Trash2,
  RotateCcw,
  Brush,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Sparkles,
} from "lucide-react"

interface ImageData {
  id: string

  file: File

  originalUrl: string

  processedUrl?: string

  brushStrokes: BrushStroke[]

  status: "pending" | "processing" | "completed" | "skipped"

  order: number
}

interface BrushStroke {
  points: Point[]

  radius: number
}

interface Point {
  x: number

  y: number
}

const translations = {
  zh: {
    appTitle: "批量马赛克工具 - 画笔模式",
    language: "语言",
    languageZh: "简体中文",
    languageEn: "English",
    uploadImages: "上传图片",
    downloadPrefix: "下载文件名前缀",
    brushSize: "画笔大小",
    mosaicBlockSize: "马赛克块大小",
    processing: "处理中",
    processAllImages: "处理全部图片",
    downloadAll: "下载全部",
    ordered: "按顺序",
    clearAll: "清空全部",
    progressTitle: "处理进度",
    progressLabel: "进度",
    statusMosaicApplied: "已应用马赛克",
    statusProcessing: "处理中...",
    statusNoBrushStrokes: "无画笔涂抹",
    statusWaiting: "等待中",
    processingComplete: "处理完成！",
    processingSummary: (completed: number, skipped: number, total: number) =>
      `${completed} 张图片已处理为马赛克，${skipped} 张图片没有画笔涂抹。已可按顺序下载全部 ${total} 张图片。`,
    downloadInfo: "💡 下载说明",
    downloadInfoLine1: "• 有画笔涂抹的图片会下载为：",
    downloadInfoLine2: "• 未涂抹的图片会下载为：",
    downloadInfoLine3: "• 文件会按你设置的上下箭头顺序下载",
    downloadInfoLine4: "• 文件会保存到浏览器默认下载目录",
    dropImagesHere: "把图片拖到这里！",
    uploadToStart: "上传图片开始使用",
    dragAndDropHint: "可从任意位置拖拽图片，或点击上传按钮",
    brushHint: "使用画笔在需要打码的位置进行涂抹",
    dropToUpload: "松开以上传图片",
    zoom: "缩放",
    loadingImage: "正在加载图片...",
    brushStrokes: "画笔笔画",
    paintHint: "在需要区域涂抹后应用马赛克效果",
    mobileTip: "移动端提示：单指可直接涂抹，双指可缩放页面查看细节。",
    removeMetadata: "下载时去除元数据",
    removeMetadataHint: "启用后会重新编码图片并清理元数据",
    brushCount: "已涂抹图片",
    readyToProcess: "待处理",
    downloading: "下载中",
    downloadReady: "处理完成，可开始下载",
    metadataEnabled: "开启",
    metadataDisabled: "关闭",
    moveUp: "上移",
    moveDown: "下移",
    clearStroke: "清除涂抹",
    deleteImage: "删除图片",
  },
  en: {
    appTitle: "Batch Mosaic Tool - Brush Mode",
    language: "Language",
    languageZh: "简体中文",
    languageEn: "English",
    uploadImages: "Upload Images",
    downloadPrefix: "Download Filename Prefix",
    brushSize: "Brush Size",
    mosaicBlockSize: "Mosaic Block Size",
    processing: "Processing",
    processAllImages: "Process All Images",
    downloadAll: "Download All",
    ordered: "Ordered",
    clearAll: "Clear All",
    progressTitle: "Processing Progress",
    progressLabel: "Progress",
    statusMosaicApplied: "Mosaic Applied",
    statusProcessing: "Processing...",
    statusNoBrushStrokes: "No Brush Strokes",
    statusWaiting: "Waiting",
    processingComplete: "Processing Complete!",
    processingSummary: (completed: number, skipped: number, total: number) =>
      `${completed} images processed with mosaic effect, ${skipped} images had no brush strokes. Ready to download all ${total} images in order.`,
    downloadInfo: "💡 Download Info",
    downloadInfoLine1: "• Images with brush strokes will be downloaded as:",
    downloadInfoLine2: "• Images without brush strokes will be downloaded as:",
    downloadInfoLine3: "• Files will be downloaded in the order you set",
    downloadInfoLine4: "• Files will be saved to your browser's default download folder",
    dropImagesHere: "Drop images here!",
    uploadToStart: "Upload images to get started",
    dragAndDropHint: "Drag and drop images here, or use the upload button",
    brushHint: "Use the brush tool to paint areas for mosaic effect",
    dropToUpload: "Drop images here to upload",
    zoom: "Zoom",
    loadingImage: "Loading image...",
    brushStrokes: "Brush strokes",
    paintHint: "Paint areas to apply mosaic effect",
    mobileTip: "Mobile tip: one finger to paint, two fingers to zoom the page for detail.",
    removeMetadata: "Remove metadata on download",
    removeMetadataHint: "When enabled, images are re-encoded and metadata is stripped",
    brushCount: "Images with strokes",
    readyToProcess: "Pending",
    downloading: "Downloading",
    downloadReady: "Processing finished, ready to download",
    metadataEnabled: "On",
    metadataDisabled: "Off",
    moveUp: "Move Up",
    moveDown: "Move Down",
    clearStroke: "Clear Strokes",
    deleteImage: "Delete Image",
  },
} as const

type Locale = keyof typeof translations
type UIText = (typeof translations)["zh"]

const sanitizeImageDataLSB = (data: Uint8ClampedArray) => {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i] & 0b11111110
    data[i + 1] = data[i + 1] & 0b11111110
    data[i + 2] = data[i + 2] & 0b11111110
  }
}

export default function MosaicFilterApp() {
  const [locale, setLocale] = useState<Locale>("en")

  const [images, setImages] = useState<ImageData[]>([])

  const [mosaicSize, setMosaicSize] = useState([10])

  const [brushSize, setBrushSize] = useState([20])

  const [isProcessing, setIsProcessing] = useState(false)

  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 })

  const [downloadPrefix, setDownloadPrefix] = useState("mosaic")

  const [removeMetadataEnabled, setRemoveMetadataEnabled] = useState(true)

  const [isDownloading, setIsDownloading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isDragOver, setIsDragOver] = useState(false)

  const text = translations[locale]

  useEffect(() => {
    const savedLocale = window.localStorage.getItem("mosaic-locale")
    if (savedLocale === "zh" || savedLocale === "en") {
      setLocale(savedLocale)
      return
    }

    setLocale(window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en")
  }, [])

  useEffect(() => {
    window.localStorage.setItem("mosaic-locale", locale)
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en"
  }, [locale])

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])

    setImages((prev) => {
      const newImages = files
        .filter((file) => file.type.startsWith("image/"))
        .map((file, index) => {
          const id = Math.random().toString(36).substr(2, 9)
          const url = URL.createObjectURL(file)

          return {
            id,
            file,
            originalUrl: url,
            brushStrokes: [],
            status: "pending" as const,
            order: prev.length + index + 1, // This ensures sequential ordering
          }
        })

      return [...prev, ...newImages]
    })
  }, [])

  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const image = prev.find((img) => img.id === id)

      if (image) {
        URL.revokeObjectURL(image.originalUrl)

        if (image.processedUrl) {
          URL.revokeObjectURL(image.processedUrl)
        }
      }

      const filtered = prev.filter((img) => img.id !== id)

      // Reorder remaining images

      return filtered.map((img, index) => ({ ...img, order: index + 1 }))
    })
  }, [])

  const clearAllImages = useCallback(() => {
    images.forEach((image) => {
      URL.revokeObjectURL(image.originalUrl)

      if (image.processedUrl) {
        URL.revokeObjectURL(image.processedUrl)
      }
    })

    setImages([])

    setProcessingProgress({ current: 0, total: 0 })
  }, [images])

  const moveImageUp = useCallback((id: string) => {
    setImages((prev) => {
      const sortedImages = [...prev].sort((a, b) => a.order - b.order)
      const currentIndex = sortedImages.findIndex((img) => img.id === id)

      if (currentIndex > 0) {
        // Create a new array with swapped orders
        const newImages = [...sortedImages]
        const temp = newImages[currentIndex].order
        newImages[currentIndex] = { ...newImages[currentIndex], order: newImages[currentIndex - 1].order }
        newImages[currentIndex - 1] = { ...newImages[currentIndex - 1], order: temp }
        return newImages
      }

      return prev
    })
  }, [])

  const moveImageDown = useCallback((id: string) => {
    setImages((prev) => {
      const sortedImages = [...prev].sort((a, b) => a.order - b.order)
      const currentIndex = sortedImages.findIndex((img) => img.id === id)

      if (currentIndex < sortedImages.length - 1) {
        // Create a new array with swapped orders
        const newImages = [...sortedImages]
        const temp = newImages[currentIndex].order
        newImages[currentIndex] = { ...newImages[currentIndex], order: newImages[currentIndex + 1].order }
        newImages[currentIndex + 1] = { ...newImages[currentIndex + 1], order: temp }
        return newImages
      }

      return prev
    })
  }, [])

  const updateImageBrushStrokes = useCallback((id: string, brushStrokes: BrushStroke[]) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, brushStrokes } : img)))
  }, [])

  const updateImageStatus = useCallback((id: string, status: ImageData["status"], processedUrl?: string) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, status, ...(processedUrl && { processedUrl }) } : img)),
    )
  }, [])

  const sanitizeBlob = useCallback(
    async (inputBlob: Blob) => {
      const bitmap = await createImageBitmap(inputBlob)
      const canvas = document.createElement("canvas")
      canvas.width = bitmap.width
      canvas.height = bitmap.height

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        bitmap.close()
        return inputBlob
      }

      ctx.drawImage(bitmap, 0, 0)
      bitmap.close()

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      sanitizeImageDataLSB(imageData.data)

      ctx.putImageData(imageData, 0, 0)

      const sanitizedBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/png")
      })

      return sanitizedBlob ?? inputBlob
    },
    [],
  )

  const applyMosaicFilter = useCallback(
    async (
      canvas: HTMLCanvasElement,

      ctx: CanvasRenderingContext2D,

      brushStrokes: BrushStroke[],

      blockSize: number,
    ) => {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      const data = imageData.data

      // Create a mask for brush areas

      const mask = new Array(canvas.width * canvas.height).fill(false)

      brushStrokes.forEach((stroke) => {
        stroke.points.forEach((point) => {
          for (let dy = -stroke.radius; dy <= stroke.radius; dy++) {
            for (let dx = -stroke.radius; dx <= stroke.radius; dx++) {
              const distance = Math.sqrt(dx * dx + dy * dy)

              if (distance <= stroke.radius) {
                const x = Math.round(point.x + dx)

                const y = Math.round(point.y + dy)

                if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
                  mask[y * canvas.width + x] = true
                }
              }
            }
          }
        })
      })

      // Apply mosaic to masked areas

      for (let y = 0; y < canvas.height; y += blockSize) {
        for (let x = 0; x < canvas.width; x += blockSize) {
          // Check if any pixel in this block is in the brush area

          let hasMarkedPixel = false

          for (let dy = 0; dy < blockSize && y + dy < canvas.height; dy++) {
            for (let dx = 0; dx < blockSize && x + dx < canvas.width; dx++) {
              if (mask[(y + dy) * canvas.width + (x + dx)]) {
                hasMarkedPixel = true

                break
              }
            }

            if (hasMarkedPixel) break
          }

          if (hasMarkedPixel) {
            // Calculate average color for the block

            let r = 0,
              g = 0,
              b = 0,
              a = 0

            let pixelCount = 0

            for (let dy = 0; dy < blockSize && y + dy < canvas.height; dy++) {
              for (let dx = 0; dx < blockSize && x + dx < canvas.width; dx++) {
                const index = ((y + dy) * canvas.width + (x + dx)) * 4

                r += data[index]

                g += data[index + 1]

                b += data[index + 2]

                a += data[index + 3]

                pixelCount++
              }
            }

            if (pixelCount > 0) {
              r = Math.round(r / pixelCount)

              g = Math.round(g / pixelCount)

              b = Math.round(b / pixelCount)

              a = Math.round(a / pixelCount)

              // Apply the average color to the entire block, but only to marked pixels

              for (let dy = 0; dy < blockSize && y + dy < canvas.height; dy++) {
                for (let dx = 0; dx < blockSize && x + dx < canvas.width; dx++) {
                  if (mask[(y + dy) * canvas.width + (x + dx)]) {
                    const index = ((y + dy) * canvas.width + (x + dx)) * 4

                    data[index] = r

                    data[index + 1] = g

                    data[index + 2] = b

                    data[index + 3] = a
                  }
                }
              }
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0)
    },

    [],
  )

  const processAllImages = useCallback(async () => {
    setIsProcessing(true)

    setProcessingProgress({ current: 0, total: images.length })

    for (let i = 0; i < images.length; i++) {
      const image = images[i]

      setProcessingProgress({ current: i + 1, total: images.length })

      if (image.brushStrokes.length === 0) {
        updateImageStatus(image.id, "skipped")

        continue
      }

      updateImageStatus(image.id, "processing")

      try {
        const img = new Image()

        img.crossOrigin = "anonymous"

        await new Promise((resolve, reject) => {
          img.onload = resolve

          img.onerror = reject

          img.src = image.originalUrl
        })

        const canvas = document.createElement("canvas")

        const ctx = canvas.getContext("2d")

        if (!ctx) {
          updateImageStatus(image.id, "skipped")

          continue
        }

        canvas.width = img.width

        canvas.height = img.height

        ctx.drawImage(img, 0, 0)

        await applyMosaicFilter(canvas, ctx, image.brushStrokes, mosaicSize[0])

        canvas.toBlob(async (blob) => {
          if (blob) {
            const finalBlob = removeMetadataEnabled ? await sanitizeBlob(blob) : blob

            const processedUrl = URL.createObjectURL(finalBlob)

            updateImageStatus(image.id, "completed", processedUrl)
          } else {
            updateImageStatus(image.id, "skipped")
          }
        }, "image/png")
      } catch (error) {
        console.error("Error processing image:", error)

        updateImageStatus(image.id, "skipped")
      }
    }

    setIsProcessing(false)
  }, [images, mosaicSize, applyMosaicFilter, updateImageStatus, removeMetadataEnabled, sanitizeBlob])

  const fetchBlobFromObjectUrl = useCallback(async (url: string) => {
    const response = await fetch(url)
    return response.blob()
  }, [])

  const triggerDownload = useCallback((blob: Blob, filename: string) => {
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(objectUrl)
  }, [])

  const downloadAllImages = useCallback(async () => {
    setIsDownloading(true)

    // Sort images by order before downloading

    const sortedImages = [...images].sort((a, b) => a.order - b.order)

    try {
      for (let index = 0; index < sortedImages.length; index++) {
        const image = sortedImages[index]
        const paddedOrder = image.order.toString().padStart(3, "0")
        const sourceUrl = image.processedUrl || image.originalUrl

        let outputBlob = await fetchBlobFromObjectUrl(sourceUrl)
        if (removeMetadataEnabled) {
          outputBlob = await sanitizeBlob(outputBlob)
        }

        const extension = removeMetadataEnabled || image.processedUrl ? "png" : image.file.name.split(".").pop() || "png"
        const fileName = image.processedUrl
          ? `${downloadPrefix}_${paddedOrder}.${extension}`
          : `${downloadPrefix}_original_${paddedOrder}.${extension}`

        triggerDownload(outputBlob, fileName)

        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    } finally {
      setIsDownloading(false)
    }
  }, [images, downloadPrefix, fetchBlobFromObjectUrl, removeMetadataEnabled, sanitizeBlob, triggerDownload])

  const hasImages = images.length > 0

  const hasBrushStrokes = images.some((img) => img.brushStrokes.length > 0)

  const pendingCount = images.filter((img) => img.status === "pending").length

  const completedCount = images.filter((img) => img.status === "completed").length

  const skippedCount = images.filter((img) => img.status === "skipped").length

  const processingComplete = !isProcessing && images.length > 0 && images.every((img) => img.status !== "pending")

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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)

    setImages((prev) => {
      const newImages = files
        .filter((file) => file.type.startsWith("image/"))
        .map((file, index) => {
          const id = Math.random().toString(36).substr(2, 9)
          const url = URL.createObjectURL(file)

          return {
            id,
            file,
            originalUrl: url,
            brushStrokes: [],
            status: "pending" as const,
            order: prev.length + index + 1,
          }
        })

      return [...prev, ...newImages]
    })
  }, [])

  // Sort images by order for display

  const sortedImages = [...images].sort((a, b) => a.order - b.order)

  return (
    <div
      className={`min-h-screen p-4 transition-colors duration-200 ${
        isDragOver ? "bg-blue-100 border-4 border-dashed border-blue-400" : "bg-gray-50"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="max-w-7xl mx-auto">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brush className="w-6 h-6" />
              {text.appTitle}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {text.mobileTip}
            </div>

            <div className="flex flex-wrap gap-4 items-end">
              <div className="min-w-[180px]">
                <Label htmlFor="locale-select">{text.language}</Label>
                <select
                  id="locale-select"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as Locale)}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="zh">{text.languageZh}</option>
                  <option value="en">{text.languageEn}</option>
                </select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="file-upload">{text.uploadImages}</Label>

                <Input
                  id="file-upload"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                />
              </div>

              <div className="min-w-[200px]">
                <Label htmlFor="download-prefix">{text.downloadPrefix}</Label>

                <Input
                  id="download-prefix"
                  type="text"
                  value={downloadPrefix}
                  onChange={(e) => setDownloadPrefix(e.target.value)}
                  placeholder="mosaic"
                />
              </div>

              <div className="min-w-[200px]">
                <Label>
                  {text.brushSize}: {brushSize[0]}px
                </Label>

                <Slider value={brushSize} onValueChange={setBrushSize} min={5} max={100} step={1} className="mt-2" />
              </div>

              <div className="min-w-[200px]">
                <Label>
                  {text.mosaicBlockSize}: {mosaicSize[0]}px
                </Label>

                <Slider value={mosaicSize} onValueChange={setMosaicSize} min={5} max={50} step={1} className="mt-2" />
              </div>

              <div className="min-w-[240px] rounded-md border border-gray-200 p-3 space-y-2">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={removeMetadataEnabled}
                    onChange={(e) => setRemoveMetadataEnabled(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium">{text.removeMetadata}</span>
                    <span className="block text-xs text-gray-500">{text.removeMetadataHint}</span>
                  </span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="rounded-md border bg-white px-3 py-2 text-sm">
                <div className="text-gray-500">{text.uploadImages}</div>
                <div className="font-semibold">{images.length}</div>
              </div>
              <div className="rounded-md border bg-white px-3 py-2 text-sm">
                <div className="text-gray-500">{text.brushCount}</div>
                <div className="font-semibold">{images.filter((img) => img.brushStrokes.length > 0).length}</div>
              </div>
              <div className="rounded-md border bg-white px-3 py-2 text-sm">
                <div className="text-gray-500">{text.readyToProcess}</div>
                <div className="font-semibold">{pendingCount}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={processAllImages}
                disabled={!hasImages || isProcessing}
                className="flex items-center gap-2"
              >
                {isProcessing
                  ? `${text.processing} ${processingProgress.current}/${processingProgress.total}...`
                  : text.processAllImages}
              </Button>

              <Button
                onClick={downloadAllImages}
                disabled={!hasImages || isDownloading}
                variant="outline"
                className="flex items-center gap-2 bg-transparent"
              >
                <Download className="w-4 h-4" />
                {isDownloading
                  ? `${text.downloading}...`
                  : `${text.downloadAll} (${images.length}) - ${text.ordered}`}
              </Button>

              <Button
                onClick={clearAllImages}
                disabled={images.length === 0}
                variant="outline"
                className="flex items-center gap-2 bg-transparent"
              >
                <Trash2 className="w-4 h-4" />
                {text.clearAll}
              </Button>
            </div>

            {/* Progress Log */}

            {(isProcessing || processingComplete) && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4" />

                  <span className="font-medium">{text.progressTitle}</span>
                </div>

                {isProcessing && (
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span>
                        {text.progressLabel}: {processingProgress.current} / {processingProgress.total}
                      </span>

                      <span>{Math.round((processingProgress.current / processingProgress.total) * 100)}%</span>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(processingProgress.current / processingProgress.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {sortedImages.map((image) => (
                    <div key={image.id} className="flex items-center gap-2 text-sm">
                      {image.status === "completed" && <CheckCircle className="w-4 h-4 text-green-500" />}

                      {image.status === "processing" && <Clock className="w-4 h-4 text-blue-500 animate-spin" />}

                      {image.status === "skipped" && <AlertCircle className="w-4 h-4 text-yellow-500" />}

                      {image.status === "pending" && <div className="w-4 h-4 rounded-full border-2 border-gray-300" />}

                      <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                        #{image.order}
                      </span>

                      <span className="truncate flex-1">{image.file.name}</span>

                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          image.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : image.status === "processing"
                              ? "bg-blue-100 text-blue-700"
                              : image.status === "skipped"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {image.status === "completed"
                          ? text.statusMosaicApplied
                          : image.status === "processing"
                            ? text.statusProcessing
                            : image.status === "skipped"
                              ? text.statusNoBrushStrokes
                              : text.statusWaiting}
                      </span>
                    </div>
                  ))}
                </div>

                {processingComplete && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckCircle className="w-5 h-5" />

                      <span className="font-medium">{text.processingComplete}</span>
                    </div>

                    <p className="text-sm text-green-700 mt-1">
                      {text.processingSummary(completedCount, skippedCount, images.length)}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 font-medium mb-1">{text.downloadInfo}</p>

              <p className="text-xs text-blue-600">
                {text.downloadInfoLine1} {downloadPrefix}_001.png, {downloadPrefix}_002.png...
                <br />
                {text.downloadInfoLine2} {downloadPrefix}_original_001.jpg...
                <br />
                {text.downloadInfoLine3}
                <br />
                {text.downloadInfoLine4}
                <br />• {text.removeMetadata}: {removeMetadataEnabled ? text.metadataEnabled : text.metadataDisabled}
              </p>
            </div>

            {isDownloading && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
                {text.downloading}...
              </div>
            )}

            {!isDownloading && processingComplete && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {text.downloadReady}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedImages.map((image) => (
            <ImageEditor
              key={image.id}
              image={image}
              brushSize={brushSize[0]}
              text={text}
              onUpdateBrushStrokes={updateImageBrushStrokes}
              onRemove={removeImage}
              onMoveUp={moveImageUp}
              onMoveDown={moveImageDown}
              canMoveUp={image.order > 1}
              canMoveDown={image.order < images.length}
            />
          ))}
        </div>

        {images.length === 0 && (
          <Card className={`transition-all duration-200 ${isDragOver ? "border-blue-400 bg-blue-50" : ""}`}>
            <CardContent className="text-center py-12">
              <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragOver ? "text-blue-500" : "text-gray-400"}`} />

              <p className={`text-lg font-medium mb-2 ${isDragOver ? "text-blue-700" : "text-gray-700"}`}>
                {isDragOver ? text.dropImagesHere : text.uploadToStart}
              </p>

              <p className="text-sm text-gray-400 mt-2">{text.dragAndDropHint}</p>

              <p className="text-xs text-gray-400 mt-1">{text.brushHint}</p>
            </CardContent>
          </Card>
        )}

        {isDragOver && (
          <div className="fixed inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-white rounded-lg p-8 shadow-lg border-2 border-blue-400 border-dashed">
              <Upload className="w-16 h-16 mx-auto mb-4 text-blue-500" />

              <p className="text-xl font-semibold text-blue-700">{text.dropToUpload}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface ImageEditorProps {
  image: ImageData

  brushSize: number

  text: UIText

  onUpdateBrushStrokes: (id: string, brushStrokes: BrushStroke[]) => void

  onRemove: (id: string) => void

  onMoveUp: (id: string) => void

  onMoveDown: (id: string) => void

  canMoveUp: boolean

  canMoveDown: boolean
}

function ImageEditor({
  image,
  brushSize,
  text,
  onUpdateBrushStrokes,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)

  const canvasContainerRef = useRef<HTMLDivElement>(null)

  const [isDrawing, setIsDrawing] = useState(false)

  const [currentStroke, setCurrentStroke] = useState<Point[]>([])

  const [imageLoaded, setImageLoaded] = useState(false)

  const [canvasScale, setCanvasScale] = useState({ x: 1, y: 1 })

  const [containerWidth, setContainerWidth] = useState(400)

  const [zoom, setZoom] = useState([100])

  useEffect(() => {
    const container = canvasContainerRef.current
    if (!container) return

    const updateWidth = () => {
      const nextWidth = Math.max(220, container.clientWidth - 2)
      setContainerWidth(nextWidth)
    }

    updateWidth()

    const observer = new ResizeObserver(updateWidth)
    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  const drawImage = useCallback(() => {
    const canvas = canvasRef.current

    const overlayCanvas = overlayCanvasRef.current

    if (!canvas || !overlayCanvas) return

    const ctx = canvas.getContext("2d")

    const overlayCtx = overlayCanvas.getContext("2d")

    if (!ctx || !overlayCtx) return

    const img = new Image()

    img.onload = () => {
      // Display size for the canvas (with zoom)

      const maxWidth = containerWidth

      const maxHeight = Math.max(360, Math.round(containerWidth * 1.35))

      let displayWidth = img.width

      let displayHeight = img.height

      // Scale down for display only

      if (displayWidth > maxWidth) {
        displayHeight = (displayHeight * maxWidth) / displayWidth

        displayWidth = maxWidth
      }

      if (displayHeight > maxHeight) {
        displayWidth = (displayWidth * maxHeight) / displayHeight

        displayHeight = maxHeight
      }

      // Apply zoom

      displayWidth = (displayWidth * zoom[0]) / 100

      displayHeight = (displayHeight * zoom[0]) / 100

      canvas.width = displayWidth

      canvas.height = displayHeight

      overlayCanvas.width = displayWidth

      overlayCanvas.height = displayHeight

      setCanvasScale({
        x: img.width / displayWidth,

        y: img.height / displayHeight,
      })

      ctx.drawImage(img, 0, 0, displayWidth, displayHeight)

      // Clear overlay and draw brush strokes

      overlayCtx.clearRect(0, 0, displayWidth, displayHeight)

      drawBrushStrokes(overlayCtx, displayWidth, displayHeight, img.width, img.height)

      setImageLoaded(true)
    }

    img.src = image.processedUrl || image.originalUrl
  }, [image, zoom, containerWidth])

  const drawBrushStrokes = useCallback(
    (ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, imgWidth: number, imgHeight: number) => {
      const scaleX = canvasWidth / imgWidth

      const scaleY = canvasHeight / imgHeight

      ctx.fillStyle = "rgba(255, 0, 0, 0.3)"

      ctx.strokeStyle = "rgba(255, 0, 0, 0.8)"

      ctx.lineWidth = 1

      image.brushStrokes.forEach((stroke) => {
        stroke.points.forEach((point) => {
          const x = point.x * scaleX

          const y = point.y * scaleY

          const radius = stroke.radius * Math.min(scaleX, scaleY)

          ctx.beginPath()

          ctx.arc(x, y, radius, 0, 2 * Math.PI)

          ctx.fill()

          ctx.stroke()
        })
      })
    },

    [image.brushStrokes],
  )

  useEffect(() => {
    drawImage()
  }, [drawImage])

  const getCanvasPos = useCallback((clientX: number, clientY: number) => {
    const canvas = overlayCanvasRef.current

    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()

    return {
      x: clientX - rect.left,

      y: clientY - rect.top,
    }
  }, [])

  const drawOverlay = useCallback(
    (previewStroke?: Point[]) => {
      const overlayCanvas = overlayCanvasRef.current
      if (!overlayCanvas) return

      const overlayCtx = overlayCanvas.getContext("2d")
      if (!overlayCtx) return

      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

      drawBrushStrokes(
        overlayCtx,
        overlayCanvas.width,
        overlayCanvas.height,
        overlayCanvas.width * canvasScale.x,
        overlayCanvas.height * canvasScale.y,
      )

      if (previewStroke && previewStroke.length > 0) {
        overlayCtx.fillStyle = "rgba(0, 255, 0, 0.5)"
        overlayCtx.strokeStyle = "rgba(0, 255, 0, 0.8)"
        overlayCtx.lineWidth = 1

        const scaleX = 1 / canvasScale.x
        const scaleY = 1 / canvasScale.y
        const radius = brushSize * Math.min(scaleX, scaleY)

        previewStroke.forEach((point) => {
          const x = point.x * scaleX
          const y = point.y * scaleY

          overlayCtx.beginPath()
          overlayCtx.arc(x, y, radius, 0, 2 * Math.PI)
          overlayCtx.fill()
          overlayCtx.stroke()
        })
      }
    },
    [brushSize, canvasScale.x, canvasScale.y, drawBrushStrokes],
  )

  const drawBrushPreview = useCallback(
    (clientX: number, clientY: number) => {
      const pos = getCanvasPos(clientX, clientY)
      const overlayCanvas = overlayCanvasRef.current
      if (!overlayCanvas) return

      const overlayCtx = overlayCanvas.getContext("2d")
      if (!overlayCtx) return

      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

      drawBrushStrokes(
        overlayCtx,
        overlayCanvas.width,
        overlayCanvas.height,
        overlayCanvas.width * canvasScale.x,
        overlayCanvas.height * canvasScale.y,
      )

      overlayCtx.strokeStyle = "rgba(0, 255, 0, 0.8)"
      overlayCtx.lineWidth = 2
      overlayCtx.setLineDash([5, 5])

      const radius = brushSize / Math.min(canvasScale.x, canvasScale.y)
      overlayCtx.beginPath()
      overlayCtx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI)
      overlayCtx.stroke()

      overlayCtx.setLineDash([])
    },
    [brushSize, canvasScale.x, canvasScale.y, drawBrushStrokes, getCanvasPos],
  )

  const beginStroke = useCallback(
    (clientX: number, clientY: number) => {
      const pos = getCanvasPos(clientX, clientY)
      const actualPos = {
        x: pos.x * canvasScale.x,
        y: pos.y * canvasScale.y,
      }

      setIsDrawing(true)
      setCurrentStroke([actualPos])
      drawOverlay([actualPos])
    },
    [canvasScale.x, canvasScale.y, drawOverlay, getCanvasPos],
  )

  const continueStroke = useCallback(
    (clientX: number, clientY: number) => {
      const pos = getCanvasPos(clientX, clientY)
      const actualPos = {
        x: pos.x * canvasScale.x,
        y: pos.y * canvasScale.y,
      }

      setCurrentStroke((prev) => {
        const next = [...prev, actualPos]
        drawOverlay(next)
        return next
      })
    },
    [canvasScale.x, canvasScale.y, drawOverlay, getCanvasPos],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      beginStroke(e.clientX, e.clientY)
    },
    [beginStroke],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      if (isDrawing) {
        continueStroke(e.clientX, e.clientY)
        return
      }

      if (e.pointerType === "mouse") {
        drawBrushPreview(e.clientX, e.clientY)
      }
    },
    [continueStroke, drawBrushPreview, isDrawing],
  )

  const handleStrokeEnd = useCallback(() => {
    if (!isDrawing || currentStroke.length === 0) return

    const newStroke: BrushStroke = {
      points: currentStroke,

      radius: brushSize,
    }

    onUpdateBrushStrokes(image.id, [...image.brushStrokes, newStroke])

    setIsDrawing(false)

    setCurrentStroke([])
  }, [isDrawing, currentStroke, brushSize, image.id, image.brushStrokes, onUpdateBrushStrokes])

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      e.currentTarget.releasePointerCapture(e.pointerId)
      handleStrokeEnd()
    },
    [handleStrokeEnd],
  )

  const handlePointerLeave = useCallback(() => {
    if (isDrawing) {
      handleStrokeEnd()
    } else {
      drawOverlay()
    }
  }, [drawOverlay, handleStrokeEnd, isDrawing])

  const clearBrushStrokes = useCallback(() => {
    onUpdateBrushStrokes(image.id, [])
  }, [image.id, onUpdateBrushStrokes])

  const getStatusIcon = () => {
    switch (image.status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />

      case "processing":
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />

      case "skipped":
        return <AlertCircle className="w-4 h-4 text-yellow-500" />

      default:
        return null
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">#{image.order}</span>

            <CardTitle className="text-sm truncate min-w-0">{image.file.name}</CardTitle>

            {getStatusIcon()}
          </div>

          <div className="flex gap-1 flex-wrap justify-end shrink-0">
            <Button size="sm" variant="outline" onClick={() => onMoveUp(image.id)} disabled={!canMoveUp} title={text.moveUp}>
              <ArrowUp className="w-3 h-3" />
            </Button>

            <Button size="sm" variant="outline" onClick={() => onMoveDown(image.id)} disabled={!canMoveDown} title={text.moveDown}>
              <ArrowDown className="w-3 h-3" />
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={clearBrushStrokes}
              disabled={image.brushStrokes.length === 0}
              title={text.clearStroke}
            >
              <RotateCcw className="w-3 h-3" />
            </Button>

            <Button size="sm" variant="outline" onClick={() => onRemove(image.id)} title={text.deleteImage}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Label className="text-xs">
              {text.zoom}: {zoom[0]}%
            </Label>

            <Slider value={zoom} onValueChange={setZoom} min={25} max={300} step={25} className="flex-1" />
          </div>

          <div ref={canvasContainerRef} className="overflow-auto max-h-[75vh] border border-gray-200 rounded w-full p-2">
            <div className="flex justify-center">
              <div className="relative w-fit">
                <canvas ref={canvasRef} className="absolute inset-0 border border-gray-300 block" />

                <canvas
                  ref={overlayCanvasRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerLeave}
                  onPointerCancel={handlePointerLeave}
                  className="relative border border-gray-300 cursor-crosshair touch-none block"
                />
              </div>
            </div>
          </div>

          {!imageLoaded && (
            <div className="w-full h-48 bg-gray-200 flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>

              <p className="text-sm text-gray-500">{text.loadingImage}</p>
            </div>
          )}

          <p className="text-xs text-gray-500">
            {text.brushStrokes}: {image.brushStrokes.length} | {text.paintHint}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
