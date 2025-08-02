"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Upload, Download, Trash2, RotateCcw, Brush, ArrowUp, ArrowDown } from "lucide-react"

interface ImageData {
  id: string
  file: File
  originalUrl: string
  processedUrl?: string
  brushStrokes: BrushStroke[]
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

export default function MosaicFilterApp() {
  const [images, setImages] = useState<ImageData[]>([])
  const [mosaicSize, setMosaicSize] = useState([10])
  const [brushSize, setBrushSize] = useState([20])
  const [isProcessing, setIsProcessing] = useState(false)
  const [downloadPrefix, setDownloadPrefix] = useState("mosaic")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])

    files.forEach((file, index) => {
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
            order: prev.length + index + 1,
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
  }, [images])

  const moveImageUp = useCallback((id: string) => {
    setImages((prev) => {
      const sortedImages = [...prev].sort((a, b) => a.order - b.order)
      const currentIndex = sortedImages.findIndex((img) => img.id === id)

      if (currentIndex > 0) {
        // Swap with previous image
        const temp = sortedImages[currentIndex].order
        sortedImages[currentIndex].order = sortedImages[currentIndex - 1].order
        sortedImages[currentIndex - 1].order = temp
      }

      return sortedImages
    })
  }, [])

  const moveImageDown = useCallback((id: string) => {
    setImages((prev) => {
      const sortedImages = [...prev].sort((a, b) => a.order - b.order)
      const currentIndex = sortedImages.findIndex((img) => img.id === id)

      if (currentIndex < sortedImages.length - 1) {
        // Swap with next image
        const temp = sortedImages[currentIndex].order
        sortedImages[currentIndex].order = sortedImages[currentIndex + 1].order
        sortedImages[currentIndex + 1].order = temp
      }

      return sortedImages
    })
  }, [])

  const updateImageBrushStrokes = useCallback((id: string, brushStrokes: BrushStroke[]) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, brushStrokes } : img)))
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

    for (const image of images) {
      if (image.brushStrokes.length === 0) continue

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
        if (!ctx) continue

        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)

        await applyMosaicFilter(canvas, ctx, image.brushStrokes, mosaicSize[0])

        canvas.toBlob((blob) => {
          if (blob) {
            const processedUrl = URL.createObjectURL(blob)
            setImages((prev) => prev.map((img) => (img.id === image.id ? { ...img, processedUrl } : img)))
          }
        }, "image/png")
      } catch (error) {
        console.error("Error processing image:", error)
      }
    }

    setIsProcessing(false)
  }, [images, mosaicSize, applyMosaicFilter])

  const downloadProcessedImages = useCallback(() => {
    // Sort images by order before downloading
    const sortedImages = [...images].sort((a, b) => a.order - b.order)

    sortedImages.forEach((image) => {
      if (image.processedUrl) {
        const link = document.createElement("a")
        link.href = image.processedUrl

        // Get file extension from original file
        const originalExt = image.file.name.split(".").pop() || "png"

        // Create ordered filename: prefix_001.ext, prefix_002.ext, etc.
        const paddedOrder = image.order.toString().padStart(3, "0")
        const filename = `${downloadPrefix}_${paddedOrder}.${originalExt}`

        link.download = filename
        link.click()
      }
    })
  }, [images, downloadPrefix])

  const hasProcessedImages = images.some((img) => img.processedUrl)
  const hasBrushStrokes = images.some((img) => img.brushStrokes.length > 0)

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
    files.forEach((file, index) => {
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
            order: prev.length + index + 1,
          },
        ])
      }
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
                <Label htmlFor="download-prefix">Download Filename Prefix</Label>
                <Input
                  id="download-prefix"
                  type="text"
                  value={downloadPrefix}
                  onChange={(e) => setDownloadPrefix(e.target.value)}
                  placeholder="mosaic"
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
                disabled={!hasBrushStrokes || isProcessing}
                className="flex items-center gap-2"
              >
                {isProcessing ? "Processing..." : "Apply Mosaic Filter"}
              </Button>

              <Button
                onClick={downloadProcessedImages}
                disabled={!hasProcessedImages}
                variant="outline"
                className="flex items-center gap-2 bg-transparent"
              >
                <Download className="w-4 h-4" />
                Download All (Ordered)
              </Button>

              <Button
                onClick={clearAllImages}
                disabled={images.length === 0}
                variant="outline"
                className="flex items-center gap-2 bg-transparent"
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </Button>
            </div>

            {hasProcessedImages && (
              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                <p className="font-medium mb-1">Download Order Preview:</p>
                <p className="text-xs">
                  Files will be downloaded as: {downloadPrefix}_001.ext, {downloadPrefix}_002.ext, etc.
                </p>
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
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  canMoveUp: boolean
  canMoveDown: boolean
}

function ImageEditor({
  image,
  brushSize,
  onUpdateBrushStrokes,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentStroke, setCurrentStroke] = useState<Point[]>([])
  const [imageLoaded, setImageLoaded] = useState(false)
  const [canvasScale, setCanvasScale] = useState({ x: 1, y: 1 })

  const drawImage = useCallback(() => {
    const canvas = canvasRef.current
    const overlayCanvas = overlayCanvasRef.current
    if (!canvas || !overlayCanvas) return

    const ctx = canvas.getContext("2d")
    const overlayCtx = overlayCanvas.getContext("2d")
    if (!ctx || !overlayCtx) return

    const img = new Image()
    img.onload = () => {
      // Display size for the canvas (smaller for UI)
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
  }, [image])

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

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">#{image.order}</span>
            <CardTitle className="text-sm truncate">{image.file.name}</CardTitle>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => onMoveUp(image.id)} disabled={!canMoveUp}>
              <ArrowUp className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => onMoveDown(image.id)} disabled={!canMoveDown}>
              <ArrowDown className="w-3 h-3" />
            </Button>
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
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="absolute inset-0 border border-gray-300"
              style={{ maxWidth: "100%", height: "auto" }}
            />
            <canvas
              ref={overlayCanvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onLoad={drawImage}
              className="relative border border-gray-300 cursor-crosshair"
              style={{ maxWidth: "100%", height: "auto" }}
            />
          </div>
          {!imageLoaded && (
            <div className="w-full h-48 bg-gray-200 flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
              <p className="text-sm text-gray-500">Processing image...</p>
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
