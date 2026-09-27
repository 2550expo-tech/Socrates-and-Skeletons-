/**
 * Web version of gallery.ts. A browser cannot search the photo library, so
 * the scanner offers only "เลือกรูปเอง" (pick photos) on the web.
 */
export type GalleryAccess = 'all' | 'limited' | 'denied' | 'blocked';

export interface GalleryImage {
  assetId: string;
  createdAt: number;
  width: number | null;
  height: number | null;
}

export const galleryAvailable = false;

export async function getGalleryAccess(): Promise<GalleryAccess> {
  return 'denied';
}

export async function requestGalleryAccess(): Promise<GalleryAccess> {
  return 'denied';
}

export async function findGalleryImages(): Promise<GalleryImage[]> {
  return [];
}

export async function galleryUri(assetId: string): Promise<string> {
  return assetId;
}
