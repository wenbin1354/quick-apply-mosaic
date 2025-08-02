"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Upload, Download, Trash2, RotateCcw, Brush, CheckCircle, Clock, AlertCircle } from "lucide-react"

interface ImageData {
  id: string
  file: File
  originalUrl: string
  processedUrl?: string
  brushStrokes: BrushStroke[]
  status: "pending" | "processing" | "completed" | "skipped"
}

interface BrushStroke {
  points: Point[]
  radius: number
}

interface Point {
  x: number
  y: number
}

export default function MosaicFilterApp() {
  const [images, setImages] = useState<ImageData[]>([])
  const [mosaicSize, setMosaicSize] = useState([10])
  const [brushSize, setBrushSize] = useState([20])
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])

    files.forEach((file) => {
      if (file.type.startsWith("image/")) {
        const id = Math.random().toString(36).substr(2, 9)
        const url = URL.createObjectURL(file)

        setImages((prev) => [
          ...prev,
          {
            id,
            file,
            originalUrl: url,
            brushStrokes: [],
            status: "pending",
          },
        ])
      }
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
      return prev.filter((img) => img.id !== id)
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

  const updateImageBrushStrokes = useCallback((id: string, brushStrokes: BrushStroke[]) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, brushStrokes } : img)))
  }, [])

  const updateImageStatus = useCallback((id: string, status: ImageData["status"], processedUrl?: string) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, status, ...(processedUrl && { processedUrl }) } : img)),
    )
  }, [])

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

        canvas.toBlob((blob) => {
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

  const downloadAllImages = useCallback(() => {
    images.forEach((image, index) => {
      setTimeout(() => {
        const link = document.createElement("a")

        if (image.processedUrl) {
          // Download processed version
          link.href = image.processedUrl
          link.download = `mosaic_${image.file.name}`
        } else {
          // Download original version
          link.href = image.originalUrl
          link.download = `original_${image.file.name}`
        }

        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }, index * 100) // Small delay between downloads to avoid browser blocking
    })
  }, [images])

  const hasImages = images.length > 0
  const hasBrushStrokes = images.some((img) => img.brushStrokes.length > 0)
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
    files.forEach((file) => {
      if (file.type.startsWith("image/")) {
        const id = Math.random().toString(36).substr(2, 9)
        const url = URL.createObjectURL(file)

        setImages((prev) => [
          ...prev,
          {
            id,
            file,
            originalUrl: url,
            brushStrokes: [],
            status: "pending",
          },
        ])
      }
    })
  }, [])

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
              Mass Mosaic Filter App - Brush Mode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="file-upload">Upload Images</Label>
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
                <Label>Brush Size: {brushSize[0]}px</Label>
                <Slider value={brushSize} onValueChange={setBrushSize} min={5} max={100} step={1} className="mt-2" />
              </div>

              <div className="min-w-[200px]">
                <Label>Mosaic Block Size: {mosaicSize[0]}px</Label>
                <Slider value={mosaicSize} onValueChange={setMosaicSize} min={5} max={50} step={1} className="mt-2" />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={processAllImages}
                disabled={!hasImages || isProcessing}
                className="flex items-center gap-2"
              >
                {isProcessing
                  ? `Processing ${processingProgress.current}/${processingProgress.total}...`
                  : "Process All Images"}
              </Button>

              <Button
                onClick={downloadAllImages}
                disabled={!hasImages}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download All ({images.length})
              </Button>

              <Button
                onClick={clearAllImages}
                disabled={images.length === 0}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </Button>
            </div>

            {/* Progress Log */}
            {(isProcessing || processingComplete) && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4" />
                  <span className="font-medium">Processing Progress</span>
                </div>

                {isProcessing && (
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span>
                        Progress: {processingProgress.current} / {processingProgress.total}
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
                  {images.map((image) => (
                    <div key={image.id} className="flex items-center gap-2 text-sm">
                      {image.status === "completed" && <CheckCircle className="w-4 h-4 text-green-500" />}
                      {image.status === "processing" && <Clock className="w-4 h-4 text-blue-500 animate-spin" />}
                      {image.status === "skipped" && <AlertCircle className="w-4 h-4 text-yellow-500" />}
                      {image.status === "pending" && <div className="w-4 h-4 rounded-full border-2 border-gray-300" />}

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
                          ? "Mosaic Applied"
                          : image.status === "processing"
                            ? "Processing..."
                            : image.status === "skipped"
                              ? "No Brush Strokes"
                              : "Waiting"}
                      </span>
                    </div>
                  ))}
                </div>

                {processingComplete && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Processing Complete!</span>
                    </div>
                    <p className="text-sm text-green-700 mt-1">
                      {completedCount} images processed with mosaic effect, {skippedCount} images without brush strokes.
                      Ready to download all {images.length} images.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 font-medium mb-1">💡 Download Information</p>
              <p className="text-xs text-blue-600">
                • Images with brush strokes will be downloaded as processed versions with mosaic effect
                <br />• Images without brush strokes will be downloaded as original files
                <br />• Files will be saved to your browser's default download folder
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map((image) => (
            <ImageEditor
              key={image.id}
              image={image}
              brushSize={brushSize[0]}
              onUpdateBrushStrokes={updateImageBrushStrokes}
              onRemove={removeImage}
            />
          ))}
        </div>

        {images.length === 0 && (
          <Card className={`transition-all duration-200 ${isDragOver ? "border-blue-400 bg-blue-50" : ""}`}>
            <CardContent className="text-center py-12">
              <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragOver ? "text-blue-500" : "text-gray-400"}`} />
              <p className={`text-lg font-medium mb-2 ${isDragOver ? "text-blue-700" : "text-gray-700"}`}>
                {isDragOver ? "Drop images here!" : "Upload images to get started"}
              </p>
              <p className="text-sm text-gray-400 mt-2">Drag & drop images from anywhere, or use the upload button</p>
              <p className="text-xs text-gray-400 mt-1">Use the brush tool to paint areas for mosaic effect</p>
            </CardContent>
          </Card>
        )}
        {isDragOver && (
          <div className="fixed inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-white rounded-lg p-8 shadow-lg border-2 border-blue-400 border-dashed">
              <Upload className="w-16 h-16 mx-auto mb-4 text-blue-500" />
              <p className="text-xl font-semibold text-blue-700">Drop images here to upload</p>
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
  onUpdateBrushStrokes: (id: string, brushStrokes: BrushStroke[]) => void
  onRemove: (id: string) => void
}

function ImageEditor({ image, brushSize, onUpdateBrushStrokes, onRemove }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentStroke, setCurrentStroke] = useState<Point[]>([])
  const [imageLoaded, setImageLoaded] = useState(false)
  const [canvasScale, setCanvasScale] = useState({ x: 1, y: 1 })
  const [zoom, setZoom] = useState([100])

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
      const maxWidth = 400
      const maxHeight = 300
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
  }, [image, zoom])

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

  const getMousePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getMousePos(e)
      const actualPos = {
        x: pos.x * canvasScale.x,
        y: pos.y * canvasScale.y,
      }
      setIsDrawing(true)
      setCurrentStroke([actualPos])
    },
    [getMousePos, canvasScale],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getMousePos(e)
      const actualPos = {
        x: pos.x * canvasScale.x,
        y: pos.y * canvasScale.y,
      }

      if (isDrawing) {
        setCurrentStroke((prev) => [...prev, actualPos])

        // Draw current stroke preview
        const overlayCanvas = overlayCanvasRef.current
        if (overlayCanvas) {
          const overlayCtx = overlayCanvas.getContext("2d")
          if (overlayCtx) {
            // Redraw everything
            overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
            drawBrushStrokes(
              overlayCtx,
              overlayCanvas.width,
              overlayCanvas.height,
              overlayCanvas.width * canvasScale.x,
              overlayCanvas.height * canvasScale.y,
            )

            // Draw current stroke
            overlayCtx.fillStyle = "rgba(0, 255, 0, 0.5)"
            overlayCtx.strokeStyle = "rgba(0, 255, 0, 0.8)"
            overlayCtx.lineWidth = 1

            const scaleX = 1 / canvasScale.x
            const scaleY = 1 / canvasScale.y
            const radius = brushSize * Math.min(scaleX, scaleY)

            currentStroke.concat([actualPos]).forEach((point) => {
              const x = point.x * scaleX
              const y = point.y * scaleY

              overlayCtx.beginPath()
              overlayCtx.arc(x, y, radius, 0, 2 * Math.PI)
              overlayCtx.fill()
              overlayCtx.stroke()
            })
          }
        }
      } else {
        // Show brush preview
        const overlayCanvas = overlayCanvasRef.current
        if (overlayCanvas) {
          const overlayCtx = overlayCanvas.getContext("2d")
          if (overlayCtx) {
            overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
            drawBrushStrokes(
              overlayCtx,
              overlayCanvas.width,
              overlayCanvas.height,
              overlayCanvas.width * canvasScale.x,
              overlayCanvas.height * canvasScale.y,
            )

            // Draw brush preview
            overlayCtx.strokeStyle = "rgba(0, 255, 0, 0.8)"
            overlayCtx.lineWidth = 2
            overlayCtx.setLineDash([5, 5])

            const radius = brushSize / Math.min(canvasScale.x, canvasScale.y)
            overlayCtx.beginPath()
            overlayCtx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI)
            overlayCtx.stroke()
            overlayCtx.setLineDash([])
          }
        }
      }
    },
    [getMousePos, canvasScale, isDrawing, currentStroke, brushSize, drawBrushStrokes],
  )

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || currentStroke.length === 0) return

    const newStroke: BrushStroke = {
      points: currentStroke,
      radius: brushSize,
    }

    onUpdateBrushStrokes(image.id, [...image.brushStrokes, newStroke])
    setIsDrawing(false)
    setCurrentStroke([])
  }, [isDrawing, currentStroke, brushSize, image.id, image.brushStrokes, onUpdateBrushStrokes])

  const handleMouseLeave = useCallback(() => {
    if (isDrawing) {
      handleMouseUp()
    } else {
      // Clear brush preview
      const overlayCanvas = overlayCanvasRef.current
      if (overlayCanvas) {
        const overlayCtx = overlayCanvas.getContext("2d")
        if (overlayCtx) {
          overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
          drawBrushStrokes(
            overlayCtx,
            overlayCanvas.width,
            overlayCanvas.height,
            overlayCanvas.width * canvasScale.x,
            overlayCanvas.height * canvasScale.y,
          )
        }
      }
    }
  }, [isDrawing, handleMouseUp, drawBrushStrokes, canvasScale])

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
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm truncate">{image.file.name}</CardTitle>
            {getStatusIcon()}
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={clearBrushStrokes} disabled={image.brushStrokes.length === 0}>
              <RotateCcw className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => onRemove(image.id)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Label className="text-xs">Zoom: {zoom[0]}%</Label>
            <Slider value={zoom} onValueChange={setZoom} min={25} max={300} step={25} className="flex-1" />
          </div>

          <div className="relative overflow-auto max-h-96 border border-gray-200 rounded">
            <canvas ref={canvasRef} className="absolute inset-0 border border-gray-300" />
            <canvas
              ref={overlayCanvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              className="relative border border-gray-300 cursor-crosshair"
            />
          </div>
          {!imageLoaded && (
            <div className="w-full h-48 bg-gray-200 flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
              <p className="text-sm text-gray-500">Loading image...</p>
            </div>
          )}
          <p className="text-xs text-gray-500">
            Brush strokes: {image.brushStrokes.length} | Paint areas to apply mosaic effect
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
