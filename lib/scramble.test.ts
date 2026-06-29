import { describe, it, expect } from "vitest"
import { shuffle, scrambleRow, scramblePixel, scrambleBlock, scrambleTomato } from "./scramble"

describe("shuffle", () => {
  it("produces deterministic output for the same key and length", () => {
    const a = shuffle("testkey", 10)
    const b = shuffle("testkey", 10)
    expect(a).toEqual(b)
  })

  it("produces different output for different keys", () => {
    const a = shuffle("key1", 20)
    const b = shuffle("key2", 20)
    expect(a).not.toEqual(b)
  })

  it("produces a valid permutation (contains all indices)", () => {
    const arr = shuffle("hello", 50)
    const sorted = [...arr].sort((a, b) => a - b)
    expect(sorted).toEqual(Array.from({ length: 50 }, (_, i) => i))
  })
})

describe("scrambleTomato", () => {
  it("encrypt then decrypt returns original pixels", () => {
    const width = 20
    const height = 15
    const original = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < original.length; i++) original[i] = i % 256

    const encrypted = scrambleTomato(original, width, height, 1.0, "encrypt")
    const decrypted = scrambleTomato(encrypted, width, height, 1.0, "decrypt")

    expect(decrypted).toEqual(original)
  })

  it("encrypted output differs from input", () => {
    const width = 20
    const height = 15
    const original = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < original.length; i++) original[i] = i % 256

    const encrypted = scrambleTomato(original, width, height, 1.0, "encrypt")
    expect(encrypted).not.toEqual(original)
  })

  it("different keys produce different output", () => {
    const width = 20
    const height = 15
    const original = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < original.length; i++) original[i] = i % 256

    const a = scrambleTomato(original, width, height, 0.5, "encrypt")
    const b = scrambleTomato(original, width, height, 1.0, "encrypt")
    expect(a).not.toEqual(b)
  })
})

describe("scrambleRow", () => {
  it("encrypt then decrypt returns original pixels", () => {
    const width = 8
    const height = 8
    const original = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < original.length; i++) original[i] = i % 256

    const xArray = shuffle("rowkey", width)
    const encrypted = scrambleRow(original, width, height, xArray, "encrypt")
    const decrypted = scrambleRow(encrypted, width, height, xArray, "decrypt")

    expect(decrypted).toEqual(original)
  })

  it("encrypted output differs from input", () => {
    const width = 8
    const height = 8
    const original = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < original.length; i++) original[i] = i % 256

    const xArray = shuffle("rowkey", width)
    const encrypted = scrambleRow(original, width, height, xArray, "encrypt")
    expect(encrypted).not.toEqual(original)
  })
})

describe("scramblePixel", () => {
  it("encrypt then decrypt returns original pixels", () => {
    const width = 8
    const height = 8
    const original = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < original.length; i++) original[i] = i % 256

    const xArray = shuffle("pixelkey", width)
    const yArray = shuffle("pixelkey", height)
    const encrypted = scramblePixel(original, width, height, xArray, yArray, "encrypt")
    const decrypted = scramblePixel(encrypted, width, height, xArray, yArray, "decrypt")

    expect(decrypted).toEqual(original)
  })
})

describe("scrambleBlock", () => {
  it("encrypt then decrypt returns original pixels (dimensions divisible by block count)", () => {
    const width = 16
    const height = 16
    const blockCountX = 4
    const blockCountY = 4
    const original = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < original.length; i++) original[i] = i % 256

    const xArray = shuffle("blockkey", blockCountX)
    const yArray = shuffle("blockkey", blockCountY)
    const encrypted = scrambleBlock(original, width, height, xArray, yArray, blockCountX, blockCountY, "encrypt")
    const decrypted = scrambleBlock(encrypted.pixels, encrypted.width, encrypted.height, xArray, yArray, blockCountX, blockCountY, "decrypt")

    expect(decrypted.width).toBe(width)
    expect(decrypted.height).toBe(height)
    expect(decrypted.pixels).toEqual(original)
  })

  it("encrypted output differs from input", () => {
    const width = 16
    const height = 16
    const blockCountX = 4
    const blockCountY = 4
    const original = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < original.length; i++) original[i] = i % 256

    const xArray = shuffle("blockkey", blockCountX)
    const yArray = shuffle("blockkey", blockCountY)
    const encrypted = scrambleBlock(original, width, height, xArray, yArray, blockCountX, blockCountY, "encrypt")

    expect(encrypted.pixels).not.toEqual(original)
  })
})
