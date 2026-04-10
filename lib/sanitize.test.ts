import { describe, expect, it } from "vitest"

import { sanitizeImageDataLSB } from "@/lib/sanitize"

describe("sanitizeImageDataLSB", () => {
  it("clears RGB least significant bit and keeps alpha unchanged", () => {
    const pixels = new Uint8ClampedArray([
      255, 127, 1, 200,
      14, 15, 16, 17,
    ])

    sanitizeImageDataLSB(pixels)

    expect(Array.from(pixels)).toEqual([
      254, 126, 0, 200,
      14, 14, 16, 17,
    ])
  })
})
