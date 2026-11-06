export class InvalidImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidImageError';
  }
}

const MAX_BYTES = 30 * 1024 * 1024;

export function validateImageFile(file: File): void {
  if (!file.type.startsWith('image/')) throw new InvalidImageError(`${file.name}: not an image`);
  if (file.size > MAX_BYTES) throw new InvalidImageError(`${file.name}: larger than 30MB`);
}

export function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  const long = Math.max(w, h);
  if (long <= max) return { width: w, height: h };
  const k = max / long;
  return { width: Math.round(w * k), height: Math.round(h * k) };
}

export async function resizeImage(file: File, maxSide = 1600): Promise<Blob> {
  validateImageFile(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new InvalidImageError(`${file.name}: cannot be decoded`);
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new InvalidImageError('encode failed'))), 'image/jpeg', 0.8),
  );
}
