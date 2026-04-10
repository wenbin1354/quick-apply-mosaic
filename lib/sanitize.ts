export const sanitizeImageDataLSB = (data: Uint8ClampedArray): void => {
  for (let index = 0; index < data.length; index += 4) {
    data[index] = data[index] & 0b11111110
    data[index + 1] = data[index + 1] & 0b11111110
    data[index + 2] = data[index + 2] & 0b11111110
  }
}
