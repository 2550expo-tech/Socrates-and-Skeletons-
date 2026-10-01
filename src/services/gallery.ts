/**
 * FR-4 gallery access on the phone (Android / iOS).
 * The web build uses gallery.web.ts instead, where only hand-picked photos are possible.
 */
import { Asset, AssetField, getPermissionsAsync, MediaType, Query, requestPermissionsAsync } from 'expo-media-library';

/** Whether this platform can search the whole photo library. */
export const galleryAvailable = true;

export type GalleryAccess = 'all' | 'limited' | 'denied' | 'blocked';

/** Current access without showing a prompt (used by the automatic scan on app open). */
export async function getGalleryAccess(): Promise<GalleryAccess> {
  const res = await getPermissionsAsync(false, ['photo']);
  if (res.granted) return res.accessPrivileges === 'limited' ? 'limited' : 'all';
  return res.canAskAgain ? 'denied' : 'blocked';
}

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
 * Read page by page, so a busy gallery is not cut off at the newest few hundred.
 */
export async function findGalleryImages(sinceMs: number, max = 20000): Promise<GalleryImage[]> {
  const PAGE = 1000;
  const out: GalleryImage[] = [];
  for (let offset = 0; offset < max; offset += PAGE) {
    const rows = await new Query()
      .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
      .gte(AssetField.CREATION_TIME, sinceMs)
      .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
      .offset(offset)
      .limit(Math.min(PAGE, max - offset))
      .exeForMetadata();
    for (const r of rows) {
      if (!r.width || !r.height || r.height >= r.width * 1.1) {
        out.push({ assetId: r.id, createdAt: r.creationTime ?? sinceMs, width: r.width, height: r.height });
      }
    }
    if (rows.length < PAGE) break;
  }
  return out;
}

export function galleryUri(assetId: string): Promise<string> {
  return new Asset(assetId).getUri();
}
