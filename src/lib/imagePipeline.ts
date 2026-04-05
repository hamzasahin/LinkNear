/**
 * Client-side image processing pipeline for avatars.
 *
 * Accepts any safe common image format and always downscales to a 512x512
 * max-dimension WebP blob. Input size is not bounded — a multi-megabyte
 * phone photo is just as valid as a 40 KB thumbnail; the output is what
 * we persist, and the output is always well under the bucket's 5 MB cap.
 *
 * Defense layers: (1) here — MIME allowlist + forced re-encode (strips
 * EXIF/ICC/XMP metadata as a side effect), (2) bucket policy in Supabase
 * Storage (5 MB cap, MIME allowlist), (3) server-side CHECK constraints on
 * any downstream table.
 */

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const OUTPUT_DIMENSION = 512
const BUCKET_MAX_BYTES = 5_000_000 // mirrors supabase/migrations/002 bucket limit
// Progressively harsher quality steps. First step is the normal quality;
// the rest are a safety net in case some pathological input produces an
// over-cap blob at 512 px (vanishingly unlikely but cheap to guard against).
const QUALITY_STEPS = [0.85, 0.75, 0.65, 0.55, 0.45] as const

export interface ProcessedImage {
  blob: Blob
  extension: 'webp'
  mimeType: 'image/webp'
}

export class ImagePipelineError extends Error {
  code: 'bad_type' | 'decode_failed' | 'encode_failed'
  constructor(code: ImagePipelineError['code'], message: string) {
    super(message)
    this.code = code
  }
}

async function decodeBitmap(file: File): Promise<ImageBitmap> {
  try {
    // `imageOrientation: 'from-image'` honors EXIF orientation so portrait
    // phone photos upload right-side-up.
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new ImagePipelineError('decode_failed', 'Could not read image')
  }
}

function encodeWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality))
}

/**
 * Validate MIME, decode, downscale to 512x512 max, and encode to WebP.
 * Never throws on input size or dimensions — it always compresses. Throws
 * `ImagePipelineError` only for unsupported formats, undecodable files, or
 * a canvas/encode failure.
 */
export async function validateAndCompress(file: File): Promise<ProcessedImage> {
  if (!file.type || !ALLOWED_MIME.includes(file.type)) {
    throw new ImagePipelineError(
      'bad_type',
      'Please upload a JPG, PNG, WebP, or GIF image.'
    )
  }

  const bitmap = await decodeBitmap(file)
  try {
    const scale = Math.min(
      1,
      OUTPUT_DIMENSION / Math.max(bitmap.width, bitmap.height)
    )
    const targetW = Math.max(1, Math.round(bitmap.width * scale))
    const targetH = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new ImagePipelineError('encode_failed', 'Your browser cannot process images.')
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH)

    for (const quality of QUALITY_STEPS) {
      const blob = await encodeWebp(canvas, quality)
      if (blob && blob.size <= BUCKET_MAX_BYTES) {
        return { blob, extension: 'webp', mimeType: 'image/webp' }
      }
    }
    throw new ImagePipelineError('encode_failed', 'Failed to compress image')
  } finally {
    bitmap.close()
  }
}
