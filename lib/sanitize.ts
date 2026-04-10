export const sanitizeImageDataLSB = (data: Uint8ClampedArray): void => {
  for (let index = 0; index < data.length; index += 4) {
    data[index] = data[index] & 0b11111110
    data[index + 1] = data[index + 1] & 0b11111110
    data[index + 2] = data[index + 2] & 0b11111110
    data[index + 3] = data[index + 3] & 0b11111110
  }
}

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])

const isPng = (bytes: Uint8Array): boolean => {
  if (bytes.length < PNG_SIGNATURE.length) {
    return false
  }

  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) {
      return false
    }
  }

  return true
}

const isCriticalChunk = (chunkTypeBytes: Uint8Array): boolean => {
  if (chunkTypeBytes.length < 1) {
    return false
  }

  return (chunkTypeBytes[0] & 0b0010_0000) === 0
}

export const stripPngAncillaryChunks = (bytes: Uint8Array): Uint8Array => {
  if (!isPng(bytes) || bytes.length < 12) {
    return bytes
  }

  const chunksToKeep: Uint8Array[] = [bytes.slice(0, PNG_SIGNATURE.length)]
  let offset = PNG_SIGNATURE.length

  while (offset + 12 <= bytes.length) {
    const length =
      (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]

    if (length < 0 || offset + 12 + length > bytes.length) {
      return bytes
    }

    const chunkStart = offset
    const chunkTypeStart = offset + 4
    const chunkTypeEnd = offset + 8
    const chunkEnd = offset + 12 + length
    const chunkType = bytes.slice(chunkTypeStart, chunkTypeEnd)
    const chunkTypeString = String.fromCharCode(...chunkType)

    if (isCriticalChunk(chunkType)) {
      chunksToKeep.push(bytes.slice(chunkStart, chunkEnd))
    }

    offset = chunkEnd

    if (chunkTypeString === "IEND") {
      break
    }
  }

  const outputLength = chunksToKeep.reduce((sum, chunk) => sum + chunk.length, 0)
  const output = new Uint8Array(outputLength)
  let writeOffset = 0

  for (const chunk of chunksToKeep) {
    output.set(chunk, writeOffset)
    writeOffset += chunk.length
  }

  return output
}
