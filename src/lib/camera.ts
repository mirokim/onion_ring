import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import type { ReferenceFile } from '@/types'
import { generateId } from '@/lib/utils'

export function isCameraAvailable(): boolean {
  return Capacitor.isNativePlatform()
}

export async function capturePhoto(): Promise<ReferenceFile | null> {
  try {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      width: 1920,
      height: 1920,
    })

    if (!photo.dataUrl) return null

    const base64Data = photo.dataUrl.split(',')[1] || ''
    const sizeEstimate = Math.round((base64Data.length * 3) / 4)

    return {
      id: generateId(),
      filename: `camera_${Date.now()}.${photo.format || 'jpeg'}`,
      mimeType: `image/${photo.format || 'jpeg'}`,
      size: sizeEstimate,
      dataUrl: photo.dataUrl,
    }
  } catch {
    return null
  }
}

export async function pickFromGallery(): Promise<ReferenceFile | null> {
  try {
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos,
    })

    if (!photo.dataUrl) return null

    const base64Data = photo.dataUrl.split(',')[1] || ''
    const sizeEstimate = Math.round((base64Data.length * 3) / 4)

    return {
      id: generateId(),
      filename: `gallery_${Date.now()}.${photo.format || 'jpeg'}`,
      mimeType: `image/${photo.format || 'jpeg'}`,
      size: sizeEstimate,
      dataUrl: photo.dataUrl,
    }
  } catch {
    return null
  }
}
