import { describe, expect, it } from "vitest"

import { buildDownloadFileName } from "@/lib/download"

describe("buildDownloadFileName", () => {
  it("uses png for processed image", () => {
    const result = buildDownloadFileName("mosaic", 1, true, false, "photo.jpg")
    expect(result).toBe("mosaic_001.png")
  })

  it("uses png when metadata removal is enabled", () => {
    const result = buildDownloadFileName("mosaic", 12, false, true, "photo.jpeg")
    expect(result).toBe("mosaic_original_012.png")
  })

  it("keeps original extension when metadata removal is disabled and image is unprocessed", () => {
    const result = buildDownloadFileName("mosaic", 9, false, false, "photo.JPG")
    expect(result).toBe("mosaic_original_009.jpg")
  })

  it("falls back to png when original name has no extension", () => {
    const result = buildDownloadFileName("mosaic", 3, false, false, "photo")
    expect(result).toBe("mosaic_original_003.png")
  })
})
