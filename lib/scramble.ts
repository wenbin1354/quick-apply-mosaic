export type ScrambleMethod = "tomato" | "block" | "row" | "pixel"

export interface ScrambleOptions {
  key: string
  method: ScrambleMethod
  direction: "encrypt" | "decrypt"
  blockCountX?: number
  blockCountY?: number
}

// --- MD5 (pure JS, synchronous) ---

function md5(input: string): string {
  const bytes = new TextEncoder().encode(input)

  function leftRotate(x: number, c: number): number {
    return (x << c) | (x >>> (32 - c))
  }

  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ]

  const K = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
    0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
    0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
    0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
    0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
    0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ]

  const origLenBits = bytes.length * 8
  const padded: number[] = Array.from(bytes)
  padded.push(0x80)
  while (padded.length % 64 !== 56) padded.push(0)
  for (let i = 0; i < 8; i++) padded.push((origLenBits >>> (i * 8)) & 0xff)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  for (let chunkStart = 0; chunkStart < padded.length; chunkStart += 64) {
    const M = new Array<number>(16)
    for (let j = 0; j < 16; j++) {
      const off = chunkStart + j * 4
      M[j] = padded[off] | (padded[off + 1] << 8) | (padded[off + 2] << 16) | (padded[off + 3] << 24)
    }

    let A = a0, B = b0, C = c0, D = d0

    for (let i = 0; i < 64; i++) {
      let F: number, g: number
      if (i < 16) { F = (B & C) | (~B & D); g = i }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16 }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16 }
      else { F = C ^ (B | ~D); g = (7 * i) % 16 }
      F = (F + A + K[i] + M[g]) | 0
      A = D; D = C; C = B
      B = (B + leftRotate(F, s[i])) | 0
    }

    a0 = (a0 + A) | 0
    b0 = (b0 + B) | 0
    c0 = (c0 + C) | 0
    d0 = (d0 + D) | 0
  }

  function toLEHex(val: number): string {
    let hex = ""
    for (let i = 0; i < 4; i++) hex += ((val >>> (i * 8)) & 0xff).toString(16).padStart(2, "0")
    return hex
  }

  return toLEHex(a0) + toLEHex(b0) + toLEHex(c0) + toLEHex(d0)
}

// --- Fisher-Yates shuffle (MD5-based, deterministic) ---

export function shuffle(key: string, length: number): number[] {
  const arr = Array.from({ length }, (_, i) => i)
  for (let i = length - 1; i > 0; i--) {
    const hex = md5(key + i).padStart(32, "0")
    const rand = parseInt(hex.substring(0, 7), 16) % (i + 1)
    const tmp = arr[rand]
    arr[rand] = arr[i]
    arr[i] = tmp
  }
  return arr
}

// --- Gilbert space-filling curve (Tomato method) ---

function gilbert2d(width: number, height: number): number[] {
  const positions: number[] = new Array(width * height)
  let pos = 0

  function generate2d(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
    const w = Math.abs(ax + ay)
    const h = Math.abs(bx + by)
    const dax = Math.sign(ax)
    const day = Math.sign(ay)
    const dbx = Math.sign(bx)
    const dby = Math.sign(by)

    if (h === 1) {
      for (let i = 0; i < w; i++) { positions[pos++] = x + y * width; x += dax; y += day }
      return
    }
    if (w === 1) {
      for (let i = 0; i < h; i++) { positions[pos++] = x + y * width; x += dbx; y += dby }
      return
    }

    let ax2 = Math.floor(ax / 2)
    let ay2 = Math.floor(ay / 2)
    let bx2 = Math.floor(bx / 2)
    let by2 = Math.floor(by / 2)
    const w2 = Math.abs(ax2 + ay2)
    const h2 = Math.abs(bx2 + by2)

    if (2 * w > 3 * h) {
      if ((w2 & 1) === 1 && w > 2) { ax2 += dax; ay2 += day }
      generate2d(x, y, ax2, ay2, bx, by)
      generate2d(x + ax2, y + ay2, ax - ax2, ay - ay2, bx, by)
    } else {
      if ((h2 & 1) === 1 && h > 2) { bx2 += dbx; by2 += dby }
      generate2d(x, y, bx2, by2, ax2, ay2)
      generate2d(x + bx2, y + by2, ax, ay, bx - bx2, by - by2)
      generate2d(x + (ax - dax) + (bx2 - dbx), y + (ay - day) + (by2 - dby), -bx2, -by2, -(ax - ax2), -(ay - ay2))
    }
  }

  if (width >= height) generate2d(0, 0, width, 0, 0, height)
  else generate2d(0, 0, 0, height, width, 0)
  return positions
}

export function scrambleTomato(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  key: number,
  direction: "encrypt" | "decrypt"
): Uint8ClampedArray {
  const pixelCount = width * height
  const rawOffset = Math.round((Math.sqrt(5) - 1) / 2 * pixelCount * key)
  const offset = ((rawOffset % pixelCount) + pixelCount) % pixelCount
  const positions = gilbert2d(width, height)
  const newPixels = new Uint8ClampedArray(pixelCount * 4)
  const loopPosition = pixelCount - offset

  if (direction === "encrypt") {
    for (let i = 0; i < loopPosition; i++) {
      const src = positions[i] * 4; const dst = positions[i + offset] * 4
      newPixels[dst] = pixels[src]; newPixels[dst + 1] = pixels[src + 1]; newPixels[dst + 2] = pixels[src + 2]; newPixels[dst + 3] = pixels[src + 3]
    }
    for (let i = loopPosition; i < pixelCount; i++) {
      const src = positions[i] * 4; const dst = positions[i - loopPosition] * 4
      newPixels[dst] = pixels[src]; newPixels[dst + 1] = pixels[src + 1]; newPixels[dst + 2] = pixels[src + 2]; newPixels[dst + 3] = pixels[src + 3]
    }
  } else {
    for (let i = 0; i < loopPosition; i++) {
      const src = positions[i + offset] * 4; const dst = positions[i] * 4
      newPixels[dst] = pixels[src]; newPixels[dst + 1] = pixels[src + 1]; newPixels[dst + 2] = pixels[src + 2]; newPixels[dst + 3] = pixels[src + 3]
    }
    for (let i = loopPosition; i < pixelCount; i++) {
      const src = positions[i - loopPosition] * 4; const dst = positions[i] * 4
      newPixels[dst] = pixels[src]; newPixels[dst + 1] = pixels[src + 1]; newPixels[dst + 2] = pixels[src + 2]; newPixels[dst + 3] = pixels[src + 3]
    }
  }

  return newPixels
}

// --- Block scramble ---

export function scrambleBlock(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  xArray: number[],
  yArray: number[],
  blockCountX: number,
  blockCountY: number,
  direction: "encrypt" | "decrypt"
): { pixels: Uint8ClampedArray; width: number; height: number } {
  const newWidth = width % blockCountX > 0 ? width + blockCountX - (width % blockCountX) : width
  const newHeight = height % blockCountY > 0 ? height + blockCountY - (height % blockCountY) : height
  const blockWidth = newWidth / blockCountX
  const blockHeight = newHeight / blockCountY
  const newPixels = new Uint8ClampedArray(newWidth * newHeight * 4)

  for (let i = 0; i < newWidth; i++) {
    for (let j = 0; j < newHeight; j++) {
      let n = j
      let m = (xArray[(n / blockHeight | 0) % blockCountX] * blockWidth + i) % newWidth
      m = xArray[(m / blockWidth | 0)] * blockWidth + m % blockWidth
      n = (yArray[(m / blockWidth | 0) % blockCountY] * blockHeight + n) % newHeight
      n = yArray[(n / blockHeight | 0)] * blockHeight + n % blockHeight

      const srcX = direction === "encrypt" ? m % width : i % width
      const srcY = direction === "encrypt" ? n % height : j % height
      const dstX = direction === "encrypt" ? i : m % newWidth
      const dstY = direction === "encrypt" ? j : n % newHeight

      const srcIdx = (srcY * width + srcX) * 4
      const dstIdx = (dstY * newWidth + dstX) * 4
      newPixels[dstIdx] = pixels[srcIdx]
      newPixels[dstIdx + 1] = pixels[srcIdx + 1]
      newPixels[dstIdx + 2] = pixels[srcIdx + 2]
      newPixels[dstIdx + 3] = pixels[srcIdx + 3]
    }
  }

  return { pixels: newPixels, width: newWidth, height: newHeight }
}

// --- Row pixel scramble ---

export function scrambleRow(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  xArray: number[],
  direction: "encrypt" | "decrypt"
): Uint8ClampedArray {
  const newPixels = new Uint8ClampedArray(width * height * 4)

  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      const m = xArray[(xArray[j % width] + i) % width]
      if (direction === "encrypt") {
        const srcIdx = (j * width + m) * 4; const dstIdx = (j * width + i) * 4
        newPixels[dstIdx] = pixels[srcIdx]; newPixels[dstIdx + 1] = pixels[srcIdx + 1]; newPixels[dstIdx + 2] = pixels[srcIdx + 2]; newPixels[dstIdx + 3] = pixels[srcIdx + 3]
      } else {
        const srcIdx = (j * width + i) * 4; const dstIdx = (j * width + m) * 4
        newPixels[dstIdx] = pixels[srcIdx]; newPixels[dstIdx + 1] = pixels[srcIdx + 1]; newPixels[dstIdx + 2] = pixels[srcIdx + 2]; newPixels[dstIdx + 3] = pixels[srcIdx + 3]
      }
    }
  }

  return newPixels
}

// --- Per-pixel scramble ---

export function scramblePixel(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  xArray: number[],
  yArray: number[],
  direction: "encrypt" | "decrypt"
): Uint8ClampedArray {
  const newPixels = new Uint8ClampedArray(width * height * 4)

  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      const m = xArray[(xArray[j % width] + i) % width]
      const n = yArray[(yArray[m % height] + j) % height]
      if (direction === "encrypt") {
        const srcIdx = (n * width + m) * 4; const dstIdx = (j * width + i) * 4
        newPixels[dstIdx] = pixels[srcIdx]; newPixels[dstIdx + 1] = pixels[srcIdx + 1]; newPixels[dstIdx + 2] = pixels[srcIdx + 2]; newPixels[dstIdx + 3] = pixels[srcIdx + 3]
      } else {
        const srcIdx = (j * width + i) * 4; const dstIdx = (n * width + m) * 4
        newPixels[dstIdx] = pixels[srcIdx]; newPixels[dstIdx + 1] = pixels[srcIdx + 1]; newPixels[dstIdx + 2] = pixels[srcIdx + 2]; newPixels[dstIdx + 3] = pixels[srcIdx + 3]
      }
    }
  }

  return newPixels
}

// --- Main entry point ---

export function processImage(
  imageData: ImageData,
  options: ScrambleOptions
): ImageData {
  const { width, height, data } = imageData
  if (width === 0 || height === 0) return imageData
  const { key, method, direction, blockCountX = 32, blockCountY = 32 } = options

  if (method === "tomato") {
    const parsed = parseFloat(key)
    const numKey = Number.isFinite(parsed) ? parsed : 1
    const result = scrambleTomato(data, width, height, numKey, direction)
    return new ImageData(result, width, height)
  }

  if (method === "block") {
    const xArray = shuffle(key, blockCountX)
    const yArray = shuffle(key, blockCountY)
    const result = scrambleBlock(data, width, height, xArray, yArray, blockCountX, blockCountY, direction)
    return new ImageData(result.pixels, result.width, result.height)
  }

  if (method === "row") {
    const xArray = shuffle(key, width)
    const result = scrambleRow(data, width, height, xArray, direction)
    return new ImageData(result, width, height)
  }

  // method === "pixel"
  const xArray = shuffle(key, width)
  const yArray = shuffle(key, height)
  const result = scramblePixel(data, width, height, xArray, yArray, direction)
  return new ImageData(result, width, height)
}
