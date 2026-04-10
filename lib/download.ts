const getFileExtension = (filename: string): string => {
  if (!filename.includes(".")) {
    return "png"
  }

  const extension = filename.split(".").pop()?.toLowerCase()
  return extension && extension.length > 0 ? extension : "png"
}

export const buildDownloadFileName = (
  prefix: string,
  order: number,
  hasProcessedVersion: boolean,
  removeMetadataEnabled: boolean,
  originalFileName: string,
): string => {
  const paddedOrder = order.toString().padStart(3, "0")
  const extension = removeMetadataEnabled || hasProcessedVersion ? "png" : getFileExtension(originalFileName)

  if (hasProcessedVersion) {
    return `${prefix}_${paddedOrder}.${extension}`
  }

  return `${prefix}_original_${paddedOrder}.${extension}`
}
