/**
 * Web version of gallery.ts. A browser cannot search the photo library, so
 * on the web the scanner offers only "เลือกรูปเอง" (pick photos).
 *
 * Test hook: the browser test and the demo video set
 * `window.__MINDPAY_TEST_GALLERY__` before the app loads, to stand in for a
 * phone's photo library. That runs the same automatic-scan code as the
 * Android app, so it can be tested and shown on a computer. A real visitor's
 * browser never has it, and a page script cannot reach real photos anyway.
 */
export type GalleryAccess = 'all' | 'limited' | 'denied' | 'blocked';

export interface GalleryImage {
  assetId: string;
  createdAt: number;
  width: number | null;
  height: number | null;
}

interface TestGallery {
  images: { id: string; uri: string; createdAt: number; width: number; height: number }[];
}

const testGallery = (): TestGallery | undefined =>
  typeof window === 'undefined' ? undefined : (window as unknown as { __MINDPAY_TEST_GALLERY__?: TestGallery }).__MINDPAY_TEST_GALLERY__;

export const galleryAvailable = !!testGallery();

export async function getGalleryAccess(): Promise<GalleryAccess> {
  return testGallery() ? 'all' : 'denied';
}

export async function requestGalleryAccess(): Promise<GalleryAccess> {
  return testGallery() ? 'all' : 'denied';
}

export async function findGalleryImages(sinceMs = 0, max = 20000): Promise<GalleryImage[]> {
  const gallery = testGallery();
  if (!gallery) return [];
  return gallery.images
    .filter((i) => i.createdAt >= sinceMs && i.height >= i.width * 1.1)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, max)
    .map((i) => ({ assetId: i.id, createdAt: i.createdAt, width: i.width, height: i.height }));
}

export async function galleryUri(assetId: string): Promise<string> {
  return testGallery()?.images.find((i) => i.id === assetId)?.uri ?? assetId;
}
