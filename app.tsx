"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { Button } from "@/components/ui/button"

import { Input } from "@/components/ui/input"

import { Label } from "@/components/ui/label"

import { Slider } from "@/components/ui/slider"
import { buildDownloadFileName } from "@/lib/download"
import { localeToHtmlLang, resolveInitialLocale, type Locale } from "@/lib/locale"
import { LANDSCAPE_ROW_SIZE, NON_LANDSCAPE_ROW_SIZE, type AspectToken } from "@/lib/row-rules"
import { sanitizeImageDataLSB, stripPngAncillaryChunks } from "@/lib/sanitize"
import JSZip from "jszip"

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
  SlidersHorizontal,
  X,
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
    chooseImages: "选择图片",
    uploadHint: "可多选，支持拖拽上传",
    showControls: "展开控制面板",
    hideControls: "收起控制面板",
    quickActions: "快捷操作",
    quickUpload: "上传",
    quickProcess: "处理",
    quickDownload: "下载",
    quickControls: "面板",
    aspectLandscape: "横图",
    aspectPortrait: "竖图",
    aspectSquare: "方图",
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
    chooseImages: "Choose Images",
    uploadHint: "Multiple selection supported, drag and drop is available",
    showControls: "Show Controls",
    hideControls: "Hide Controls",
    quickActions: "Quick Actions",
    quickUpload: "Upload",
    quickProcess: "Process",
    quickDownload: "Download",
    quickControls: "Controls",
    aspectLandscape: "Landscape",
    aspectPortrait: "Portrait",
    aspectSquare: "Square",
  },
} as const

interface UIText {
  appTitle: string
  language: string
  languageZh: string
  languageEn: string
  uploadImages: string
  downloadPrefix: string
  brushSize: string
  mosaicBlockSize: string
  processing: string
  processAllImages: string
  downloadAll: string
  ordered: string
  clearAll: string
  progressTitle: string
  progressLabel: string
  statusMosaicApplied: string
  statusProcessing: string
  statusNoBrushStrokes: string
  statusWaiting: string
  processingComplete: string
  processingSummary: (completed: number, skipped: number, total: number) => string
  downloadInfo: string
  downloadInfoLine1: string
  downloadInfoLine2: string
  downloadInfoLine3: string
  downloadInfoLine4: string
  dropImagesHere: string
  uploadToStart: string
  dragAndDropHint: string
  brushHint: string
  dropToUpload: string
  zoom: string
  loadingImage: string
  brushStrokes: string
  paintHint: string
  mobileTip: string
  removeMetadata: string
  removeMetadataHint: string
  brushCount: string
  readyToProcess: string
  downloading: string
  downloadReady: string
  metadataEnabled: string
  metadataDisabled: string
  moveUp: string
  moveDown: string
  clearStroke: string
  deleteImage: string
  chooseImages: string
  uploadHint: string
  showControls: string
  hideControls: string
  quickActions: string
  quickUpload: string
  quickProcess: string
  quickDownload: string
  quickControls: string
  aspectLandscape: string
  aspectPortrait: string
  aspectSquare: string
}

type AspectType = "landscape" | "portrait" | "square"

interface DesktopRowItem {
  image: ImageData
  span: number
}

interface DesktopRow {
  items: DesktopRowItem[]
}

export default function MosaicFilterApp() {
  const [locale, setLocale] = useState<Locale>("en")

  const [images, setImages] = useState<ImageData[]>([])

  const [mosaicSize, setMosaicSize] = useState([10])

  const [brushSize, setBrushSize] = useState([35])

  const [isProcessing, setIsProcessing] = useState(false)

  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 })

  const [downloadPrefix, setDownloadPrefix] = useState("mosaic")

  const [removeMetadataEnabled, setRemoveMetadataEnabled] = useState(true)

  const [isDownloading, setIsDownloading] = useState(false)

  const [hasClickedDownload, setHasClickedDownload] = useState(false)

  const [isMobileControlPanelOpen, setIsMobileControlPanelOpen] = useState(false)

  const [imageAspectRatioById, setImageAspectRatioById] = useState<Record<string, number>>({})

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isDragOver, setIsDragOver] = useState(false)

  const text: UIText = translations[locale]

  useEffect(() => {
    const savedLocale = window.localStorage.getItem("mosaic-locale")
    setLocale(resolveInitialLocale(savedLocale, window.navigator.language))
  }, [])

  useEffect(() => {
    window.localStorage.setItem("mosaic-locale", locale)
    document.documentElement.lang = localeToHtmlLang(locale)
  }, [locale])

  useEffect(() => {
    const validIds = new Set(images.map((image) => image.id))
    setImageAspectRatioById((prev) => {
      const nextEntries = Object.entries(prev).filter(([id]) => validIds.has(id))
      if (nextEntries.length === Object.keys(prev).length) {
        return prev
      }
      return Object.fromEntries(nextEntries)
    })
  }, [images])

  useEffect(() => {
    const missingImages = images.filter((image) => imageAspectRatioById[image.id] == null)
    if (missingImages.length === 0) {
      return
    }

    let isCancelled = false

    missingImages.forEach((image) => {
      const preview = new Image()
      preview.onload = () => {
        if (isCancelled || preview.width <= 0 || preview.height <= 0) {
          return
        }

        const ratio = preview.width / preview.height
        setImageAspectRatioById((prev) => {
          if (prev[image.id] != null) {
            return prev
          }
          return { ...prev, [image.id]: ratio }
        })
      }
      preview.src = image.originalUrl
    })

    return () => {
      isCancelled = true
    }
  }, [imageAspectRatioById, images])

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])

    setHasClickedDownload(false)

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
    setHasClickedDownload(false)

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
    setHasClickedDownload(false)

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

      if (!sanitizedBlob) {
        return inputBlob
      }

      const pngBytes = new Uint8Array(await sanitizedBlob.arrayBuffer())
      const strippedPngBytes = stripPngAncillaryChunks(pngBytes)
      return new Blob([strippedPngBytes], { type: "image/png" })
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
    setHasClickedDownload(false)

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
            const processedUrl = URL.createObjectURL(blob)

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
  }, [images, mosaicSize, applyMosaicFilter, updateImageStatus])

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

    const isMobileViewport = window.matchMedia("(max-width: 767px)").matches

    try {
      if (isMobileViewport && sortedImages.length > 1) {
        const zip = new JSZip()

        for (let index = 0; index < sortedImages.length; index++) {
          const image = sortedImages[index]
          const sourceUrl = image.processedUrl || image.originalUrl

          let outputBlob = await fetchBlobFromObjectUrl(sourceUrl)
          if (removeMetadataEnabled) {
            outputBlob = await sanitizeBlob(outputBlob)
          }

          const fileName = buildDownloadFileName(
            downloadPrefix,
            image.order,
            Boolean(image.processedUrl),
            removeMetadataEnabled,
            image.file.name,
          )

          zip.file(fileName, outputBlob)
        }

        const zipBlob = await zip.generateAsync({ type: "blob" })
        triggerDownload(zipBlob, `${downloadPrefix}_batch.zip`)
        setHasClickedDownload(true)
        return
      }

      for (let index = 0; index < sortedImages.length; index++) {
        const image = sortedImages[index]
        const sourceUrl = image.processedUrl || image.originalUrl

        let outputBlob = await fetchBlobFromObjectUrl(sourceUrl)
        if (removeMetadataEnabled) {
          outputBlob = await sanitizeBlob(outputBlob)
        }

        const fileName = buildDownloadFileName(
          downloadPrefix,
          image.order,
          Boolean(image.processedUrl),
          removeMetadataEnabled,
          image.file.name,
        )

        triggerDownload(outputBlob, fileName)

        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      setHasClickedDownload(true)
    } finally {
      setIsDownloading(false)
    }
  }, [images, downloadPrefix, fetchBlobFromObjectUrl, removeMetadataEnabled, sanitizeBlob, triggerDownload])

  const hasImages = images.length > 0

  const hasBrushStrokes = images.some((img) => img.brushStrokes.length > 0)

  const pendingCount = images.filter((img) => img.status === "pending").length

  const completedCount = images.filter((img) => img.status === "completed").length

  const skippedCount = images.filter((img) => img.status === "skipped").length

  const progressPercent =
    processingProgress.total > 0 ? Math.round((processingProgress.current / processingProgress.total) * 100) : 0

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
    setHasClickedDownload(false)

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

  const classifyAspectType = useCallback((ratio?: number): AspectType => {
    if (!ratio || !Number.isFinite(ratio)) {
      return "square"
    }

    const portraitBase = 832 / 1216
    const landscapeBase = 1216 / 832
    const squareBase = 1
    const tolerance = 0.05

    const withinTolerance = (target: number) => Math.abs(ratio - target) / target <= tolerance

    if (withinTolerance(landscapeBase) || ratio > 1.15) {
      return "landscape"
    }

    if (withinTolerance(portraitBase) || ratio < 0.87) {
      return "portrait"
    }

    if (withinTolerance(squareBase)) {
      return "square"
    }

    return ratio > 1 ? "landscape" : "portrait"
  }, [])

  const getAspectTypeByImageId = useCallback(
    (imageId: string): AspectType => {
      const ratio = imageAspectRatioById[imageId]
      return classifyAspectType(ratio)
    },
    [classifyAspectType, imageAspectRatioById],
  )

  const getAspectTokenByImageId = useCallback(
    (imageId: string): AspectToken => {
      const aspectType = getAspectTypeByImageId(imageId)
      if (aspectType === "landscape") {
        return "L"
      }
      if (aspectType === "square") {
        return "S"
      }
      return "P"
    },
    [getAspectTypeByImageId],
  )

  const desktopRows = useMemo(() => {
    if (sortedImages.length === 0) {
      return []
    }

    const tokens = sortedImages.map((image) => getAspectTokenByImageId(image.id))
    const rows: DesktopRow[] = []
    let index = 0

    while (index < sortedImages.length) {
      const currentToken = tokens[index]
      const isLandscapeStart = currentToken === "L"
      let endIndex = index + 1

      if (isLandscapeStart) {
        endIndex = Math.min(sortedImages.length, index + LANDSCAPE_ROW_SIZE)
      } else {
        while (
          endIndex < sortedImages.length &&
          tokens[endIndex] !== "L" &&
          endIndex - index < NON_LANDSCAPE_ROW_SIZE
        ) {
          endIndex += 1
        }
      }

      const candidate = sortedImages.slice(index, endIndex)

      rows.push({
        items: candidate.map((image) => ({
          image,
          span: getAspectTokenByImageId(image.id) === "L" ? 2 : 1,
        })),
      })

      index = endIndex
    }

    return rows
  }, [getAspectTokenByImageId, sortedImages])

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
        <Card className="mb-6 md:hidden">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2 min-w-0">
              <CardTitle className="flex items-center gap-2 min-w-0 flex-1">
                <Brush className="w-6 h-6 shrink-0" />
                <span className="truncate">{text.appTitle}</span>
              </CardTitle>
            </div>

            <div className="md:hidden rounded-md bg-blue-50 text-blue-700 text-xs px-3 py-2">
              {text.mobileTip}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="hidden md:block space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 break-words">
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

              <div className="flex-1 min-w-[200px] min-w-0">
                <Label htmlFor="file-upload">{text.uploadImages}</Label>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Input
                    id="file-upload"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    ref={fileInputRef}
                    className="max-w-[260px] cursor-pointer"
                  />

                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 max-w-full text-xs sm:text-sm"
                  >
                    <Upload className="w-4 h-4" />
                    <span className="truncate">{text.chooseImages}</span>
                  </Button>
                </div>

                <p className="text-xs text-gray-500 mt-1 break-words">{text.uploadHint}</p>
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

                <Slider value={brushSize} onValueChange={setBrushSize} min={5} max={150} step={1} className="mt-2" />
              </div>

              <div className="min-w-[200px]">
                <Label>
                  {text.mosaicBlockSize}: {mosaicSize[0]}px
                </Label>

                <Slider value={mosaicSize} onValueChange={setMosaicSize} min={5} max={50} step={1} className="mt-2" />
              </div>

              <div className="min-w-[240px] rounded-md border border-gray-200 p-3 space-y-2 min-w-0">
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

            </div>

            <div className="hidden md:block sticky top-2 z-30 bg-white/95 backdrop-blur border border-gray-200 rounded-lg p-2 shadow-sm">
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
                    <div key={image.id} className="flex items-center gap-2 text-sm min-w-0">
                      {image.status === "completed" && <CheckCircle className="w-4 h-4 text-green-500" />}

                      {image.status === "processing" && <Clock className="w-4 h-4 text-blue-500 animate-spin" />}

                      {image.status === "skipped" && <AlertCircle className="w-4 h-4 text-yellow-500" />}

                      {image.status === "pending" && <div className="w-4 h-4 rounded-full border-2 border-gray-300" />}

                      <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                        #{image.order}
                      </span>

                      <span className="flex-1 min-w-0 break-all sm:truncate sm:whitespace-nowrap">{image.file.name}</span>

                      <span
                        className={`text-xs px-2 py-1 rounded max-w-[130px] truncate ${
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

              <p className="text-xs text-blue-600 break-words">
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

        <div className="hidden md:grid md:grid-cols-[270px_minmax(0,1fr)] gap-4 items-start mb-6">
          <aside className="sticky top-3 max-h-[calc(100vh-1.5rem)] overflow-y-auto pl-1 pr-2 py-1 space-y-4 text-foreground">
            <div className="space-y-1">
              <p className="text-sm font-semibold">{text.quickControls}</p>
              <p className="text-xs text-gray-500">{text.mobileTip}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desktop-locale-select">{text.language}</Label>
              <select
                id="desktop-locale-select"
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="zh">{text.languageZh}</option>
                <option value="en">{text.languageEn}</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desktop-upload">{text.uploadImages}</Label>
              <Input
                id="desktop-upload"
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desktop-download-prefix">{text.downloadPrefix}</Label>
              <Input
                id="desktop-download-prefix"
                type="text"
                value={downloadPrefix}
                onChange={(e) => setDownloadPrefix(e.target.value)}
                placeholder="mosaic"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span>{text.brushSize}</span>
                <span>{brushSize[0]}px</span>
              </div>
              <Slider value={brushSize} onValueChange={setBrushSize} min={5} max={150} step={1} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span>{text.mosaicBlockSize}</span>
                <span>{mosaicSize[0]}px</span>
              </div>
              <Slider value={mosaicSize} onValueChange={setMosaicSize} min={5} max={50} step={1} />
            </div>

            <label className="flex items-start gap-2 text-sm p-2 cursor-pointer bg-gray-50 rounded-md">
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

            <div className="grid grid-cols-3 gap-2">
              <Button type="button" size="sm" onClick={processAllImages} disabled={!hasImages || isProcessing} className="text-xs">
                {text.quickProcess}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={downloadAllImages}
                disabled={!hasImages || isDownloading}
                className="text-xs bg-transparent"
              >
                {text.quickDownload}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={clearAllImages}
                disabled={images.length === 0}
                className="text-xs bg-transparent"
              >
                {text.clearAll}
              </Button>
            </div>

            {processingProgress.total > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{text.progressLabel}</span>
                  <span>
                    {processingProgress.current}/{processingProgress.total} ({progressPercent}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            )}
          </aside>

          <div className="space-y-4 min-w-0">
            <div className="space-y-6">
              {desktopRows.map((row) => {
                const landscapeCount = row.items.filter((item) => item.span === 2).length
                const hasLandscape = landscapeCount > 0
                const isMixedLandscapeRow = row.items.length === 2 && landscapeCount === 1
                const rowColumnCount = hasLandscape ? 2 : 3

                let gridTemplateColumns = `repeat(${rowColumnCount}, minmax(0, 1fr))`

                if (isMixedLandscapeRow) {
                  const firstItem = row.items[0]
                  const firstIsLandscape = getAspectTypeByImageId(firstItem.image.id) === "landscape"

                  gridTemplateColumns = firstIsLandscape
                    ? "2fr 1fr"
                    : "1fr 2fr"
                }

                return (
                  <div
                    key={`desktop-row-${row.items[0]?.image.id ?? "empty"}`}
                    className="grid gap-6"
                    style={{ gridTemplateColumns }}
                  >
                    {row.items.map(({ image, span }) => {
                      const itemColSpan = hasLandscape ? 1 : span
                      const itemAspectType = getAspectTypeByImageId(image.id)
                      const isLandscapeItem = itemAspectType === "landscape"
                      const mixedRowWidthStyle = isMixedLandscapeRow
                        ? { maxWidth: isLandscapeItem ? "760px" : "420px" }
                        : undefined
                      return (
                        <div
                          key={image.id}
                          className={`${itemColSpan === 2 ? "col-span-2" : "col-span-1"} w-full justify-self-start`}
                          style={mixedRowWidthStyle}
                        >
                          <ImageEditor
                            image={image}
                            aspectType={itemAspectType}
                            brushSize={brushSize[0]}
                            text={text}
                            onUpdateBrushStrokes={updateImageBrushStrokes}
                            onRemove={removeImage}
                            onMoveUp={moveImageUp}
                            onMoveDown={moveImageDown}
                            canMoveUp={image.order > 1}
                            canMoveDown={image.order < images.length}
                          />
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {images.length === 0 && (
              <Card
                className={`transition-all duration-200 cursor-pointer ${isDragOver ? "border-blue-400 bg-blue-50" : ""}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <CardContent className="text-center py-12">
                  <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragOver ? "text-blue-500" : "text-gray-400"}`} />

                  <p className={`text-lg font-medium mb-2 ${isDragOver ? "text-blue-700" : "text-gray-700"}`}>
                    {isDragOver ? text.dropImagesHere : text.uploadToStart}
                  </p>

                  <p className="text-sm text-gray-400 mt-2">{text.dragAndDropHint}</p>

                  <p className="text-xs text-gray-400 mt-1">{text.brushHint}</p>

                  <Button
                    type="button"
                    className="mt-4"
                    onClick={(event) => {
                      event.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {text.chooseImages}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:hidden gap-6 mb-24">
          {sortedImages.map((image) => (
            <ImageEditor
              key={image.id}
              image={image}
              aspectType={getAspectTypeByImageId(image.id)}
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
          <Card
            className={`md:hidden transition-all duration-200 cursor-pointer ${isDragOver ? "border-blue-400 bg-blue-50" : ""}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <CardContent className="text-center py-12">
              <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragOver ? "text-blue-500" : "text-gray-400"}`} />

              <p className={`text-lg font-medium mb-2 ${isDragOver ? "text-blue-700" : "text-gray-700"}`}>
                {isDragOver ? text.dropImagesHere : text.uploadToStart}
              </p>

              <p className="text-sm text-gray-400 mt-2">{text.dragAndDropHint}</p>

              <p className="text-xs text-gray-400 mt-1">{text.brushHint}</p>

              <Button
                type="button"
                className="mt-4"
                onClick={(event) => {
                  event.stopPropagation()
                  fileInputRef.current?.click()
                }}
              >
                <Upload className="w-4 h-4 mr-2" />
                {text.chooseImages}
              </Button>
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

        <div className="md:hidden fixed bottom-3 inset-x-3 z-40 rounded-xl border border-gray-200 bg-white/95 backdrop-blur px-3 py-2 shadow-lg">
          {processingProgress.total > 0 && (
            <div className="mb-2">
              <div className="flex justify-between text-[11px] text-gray-600 mb-1 min-w-0">
                <span className="truncate">
                  {text.progressLabel}: {processingProgress.current}/{processingProgress.total}
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          )}

          {!isDownloading && processingComplete && (
            <div className="mb-2 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-[11px] text-green-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="truncate">{text.downloadReady}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()} className="text-xs min-w-0">
              <span className="truncate">{text.quickUpload}</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={processAllImages}
              disabled={!hasImages || isProcessing}
              className="text-xs min-w-0"
            >
              <span className="truncate">{text.quickProcess}</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={downloadAllImages}
              disabled={!hasImages || isDownloading}
              className={`text-xs min-w-0 bg-transparent ${
                !isDownloading && hasClickedDownload ? "border-green-400 text-green-700 bg-green-50" : ""
              }`}
            >
              <span className="truncate">
                {text.quickDownload}
                {!isDownloading && hasClickedDownload ? " ✓" : ""}
              </span>
            </Button>
          </div>
        </div>

        <div className="md:hidden fixed bottom-24 right-4 z-40">
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => setIsMobileControlPanelOpen(true)}
            className="h-12 w-12 rounded-full bg-white shadow-lg"
            title={text.quickControls}
          >
            <SlidersHorizontal className="w-5 h-5" />
          </Button>
        </div>

        {isMobileControlPanelOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-black/40">
            <div
              className="absolute left-0 right-0 bottom-0 rounded-t-2xl bg-white max-h-[85vh] overflow-y-auto px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">{text.quickControls}</h3>
                <Button type="button" size="icon" variant="ghost" onClick={() => setIsMobileControlPanelOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-5">
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800 break-words">
                  {text.mobileTip}
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="mobile-locale-select">{text.language}</Label>
                    <select
                      id="mobile-locale-select"
                      value={locale}
                      onChange={(e) => setLocale(e.target.value as Locale)}
                      className="mt-1 w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    >
                      <option value="zh">{text.languageZh}</option>
                      <option value="en">{text.languageEn}</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="mobile-download-prefix">{text.downloadPrefix}</Label>
                    <Input
                      id="mobile-download-prefix"
                      type="text"
                      value={downloadPrefix}
                      onChange={(e) => setDownloadPrefix(e.target.value)}
                      placeholder="mosaic"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      {text.brushSize}: {brushSize[0]}px
                    </Label>
                    <Slider value={brushSize} onValueChange={setBrushSize} min={5} max={150} step={1} className="mt-1" />
                  </div>

                  <div className="space-y-2">
                    <Label>
                      {text.mosaicBlockSize}: {mosaicSize[0]}px
                    </Label>
                    <Slider value={mosaicSize} onValueChange={setMosaicSize} min={5} max={50} step={1} className="mt-1" />
                  </div>

                  <div className="rounded-md border border-gray-200 p-3 space-y-2.5">
                    <label className="flex items-start gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={removeMetadataEnabled}
                        onChange={(e) => setRemoveMetadataEnabled(e.target.checked)}
                      />
                      <span className="leading-relaxed">
                        <span className="font-medium">{text.removeMetadata}</span>
                        <span className="block text-xs text-gray-500">{text.removeMetadataHint}</span>
                      </span>
                    </label>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      clearAllImages()
                      setIsMobileControlPanelOpen(false)
                    }}
                    disabled={images.length === 0}
                    className="w-full"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {text.clearAll}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

interface ImageEditorProps {
  image: ImageData

  aspectType: AspectType

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
  aspectType,
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

  const [baseDimensions, setBaseDimensions] = useState<{ width: number; height: number } | null>(null)

  const hasEverLoadedRef = useRef(false)

  const sourceUrl = image.processedUrl || image.originalUrl

  useEffect(() => {
    const container = canvasContainerRef.current
    if (!container) return

    const updateWidth = () => {
      const availableWidth = container.clientWidth - 2
      const isDesktop = window.matchMedia("(min-width: 768px)").matches
      const boundedWidth = isDesktop ? Math.min(760, availableWidth) : availableWidth
      const nextWidth = Math.max(220, boundedWidth)
      setContainerWidth(nextWidth)
    }

    updateWidth()

    const observer = new ResizeObserver(updateWidth)
    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      setBaseDimensions({ width: img.width, height: img.height })
    }
    img.src = image.originalUrl
  }, [image.originalUrl])

  const drawImage = useCallback(() => {
    const canvas = canvasRef.current

    const overlayCanvas = overlayCanvasRef.current

    if (!canvas || !overlayCanvas) return

    const ctx = canvas.getContext("2d")

    if (!ctx) return

    const img = new Image()

    img.onload = () => {
      // Display size for the canvas (with zoom)

      const maxWidth = containerWidth

      const maxHeight = Math.max(360, Math.round(containerWidth * 1.35))

      let displayWidth: number

      let displayHeight: number

      const sizingWidth = baseDimensions?.width ?? img.width
      const sizingHeight = baseDimensions?.height ?? img.height

      displayWidth = sizingWidth
      displayHeight = sizingHeight

      if (displayWidth > maxWidth) {
        displayHeight = (displayHeight * maxWidth) / displayWidth
        displayWidth = maxWidth
      }

      if (displayHeight > maxHeight) {
        displayWidth = (displayWidth * maxHeight) / displayHeight
        displayHeight = maxHeight
      }

      displayWidth = (displayWidth * zoom[0]) / 100
      displayHeight = (displayHeight * zoom[0]) / 100

      displayWidth = Math.max(1, Math.round(displayWidth))
      displayHeight = Math.max(1, Math.round(displayHeight))

      canvas.width = displayWidth

      canvas.height = displayHeight

      overlayCanvas.width = displayWidth

      overlayCanvas.height = displayHeight

      setCanvasScale({
        x: sizingWidth / displayWidth,

        y: sizingHeight / displayHeight,
      })

      ctx.drawImage(img, 0, 0, displayWidth, displayHeight)

      hasEverLoadedRef.current = true
      setImageLoaded(true)
    }

    img.src = sourceUrl
  }, [baseDimensions?.height, baseDimensions?.width, sourceUrl, zoom, containerWidth])

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
    if (!hasEverLoadedRef.current) {
      setImageLoaded(false)
    }
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

  useEffect(() => {
    if (!imageLoaded) return
    drawOverlay()
  }, [drawOverlay, imageLoaded])

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

  const getAspectLabel = () => {
    switch (aspectType) {
      case "landscape":
        return text.aspectLandscape
      case "portrait":
        return text.aspectPortrait
      default:
        return text.aspectSquare
    }
  }

  const getAspectBadgeClass = () => {
    switch (aspectType) {
      case "landscape":
        return "bg-purple-100 text-purple-700"
      case "portrait":
        return "bg-emerald-100 text-emerald-700"
      default:
        return "bg-slate-100 text-slate-700"
    }
  }

  const desktopPreviewHeightClass =
    aspectType === "portrait" ? "md:h-[520px] md:max-h-[520px]" : "md:h-[420px] md:max-h-[420px]"

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:min-w-0">
          <div className="flex items-center gap-2 min-w-0 w-full sm:flex-1 sm:min-w-0 overflow-hidden">
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">#{image.order}</span>

            <span className={`text-xs font-medium px-2 py-1 rounded shrink-0 ${getAspectBadgeClass()}`}>
              {getAspectLabel()}
            </span>

            <CardTitle className="text-sm min-w-0 flex-1 overflow-hidden break-all sm:truncate sm:whitespace-nowrap sm:block">
              {image.file.name}
            </CardTitle>

            <span className="shrink-0">{getStatusIcon()}</span>
          </div>

          <div className="flex gap-1 flex-wrap justify-end shrink-0 w-full sm:w-auto sm:ml-2">
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

      <CardContent className="flex-1">
        <div className="space-y-2 h-full flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <Label className="text-xs">
              {text.zoom}: {zoom[0]}%
            </Label>

            <Slider value={zoom} onValueChange={setZoom} min={25} max={300} step={25} className="flex-1" />
          </div>

          <div
            ref={canvasContainerRef}
            className={`overflow-auto border border-gray-200 rounded w-full p-2 flex-1 ${desktopPreviewHeightClass}`}
          >
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
