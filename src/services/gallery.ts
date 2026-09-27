/**
 * FR-4 gallery access on the phone (Android / iOS).
 * The web build uses gallery.web.ts instead, where only hand-picked photos are possible.
 */
import { Asset, AssetField, MediaType, Query, requestPermissionsAsync } from 'expo-media-library';

/** Whether this platform can search the whole photo library. */
export const galleryAvailable = true;

export type GalleryAccess = 'all' | 'limited' | 'denied' | 'blocked';

export async function requestGalleryAccess(): Promise<GalleryAccess> {
  const res = await requestPermissionsAsync(false, ['photo']);
  if (res.granted) return res.accessPrivileges === 'limited' ? 'limited' : 'all';
  return res.canAskAgain ? 'denied' : 'blocked';
}

export interface GalleryImage {
  assetId: string;
  createdAt: number;
  width: number | null;
  height: number | null;
}

/**
 * Photos created since `sinceMs`, newest first. Landscape photos are skipped:
 * bank slips are always portrait, which removes most camera photos cheaply.
 */
export async function findGalleryImages(sinceMs: number, max = 3000): Promise<GalleryImage[]> {
  const rows = await new Query()
    .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
    .gte(AssetField.CREATION_TIME, sinceMs)
    .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
    .limit(max)
    .exeForMetadata();
  return rows
    .filter((r) => !r.width || !r.height || r.height >= r.width * 1.1)
    .map((r) => ({ assetId: r.id, createdAt: r.creationTime ?? sinceMs, width: r.width, height: r.height }));
}

export function galleryUri(assetId: string): Promise<string> {
  return new Asset(assetId).getUri();
}
