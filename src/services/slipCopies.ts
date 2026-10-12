/**
 * Copies of slip pictures, kept only on this phone (MindPay ใหม่).
 *
 * After a slip is read and saved, the small JPEG that was read (about 1100 px
 * wide) is stored in the app's own folder, one folder per account, named by the
 * picture's hash (the same hash the transaction keeps). The copy never goes to the
 * MindPay server, and it stays even if the photo is deleted from the gallery.
 * Web: see slipCopies.web.ts (the browser's own storage).
 */
import { Directory, File, Paths } from 'expo-file-system';

const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '');
const folder = (owner: string) => new Directory(Paths.document, 'slips', safe(owner));
const fileOf = (owner: string, hash: string) => new File(folder(owner), `${safe(hash)}.jpg`);

export async function saveSlipCopy(owner: string, hash: string, base64: string): Promise<void> {
  const dir = folder(owner);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const file = fileOf(owner, hash);
  if (file.exists) return;
  file.create();
  file.write(base64, { encoding: 'base64' });
}

/** Where to show the copy from, or null when this phone has none (read on another device, or before this update). */
export async function slipCopyUri(owner: string, hash: string): Promise<string | null> {
  const file = fileOf(owner, hash);
  return file.exists ? file.uri : null;
}

export async function deleteSlipCopy(owner: string, hash: string): Promise<void> {
  const file = fileOf(owner, hash);
  if (file.exists) file.delete();
}

export async function slipCopyStats(owner: string): Promise<{ count: number; bytes: number }> {
  const dir = folder(owner);
  if (!dir.exists) return { count: 0, bytes: 0 };
  const files = dir.list().filter((x): x is File => x instanceof File);
  return { count: files.length, bytes: files.reduce((sum, f) => sum + (f.size ?? 0), 0) };
}

export async function deleteAllSlipCopies(owner: string): Promise<void> {
  const dir = folder(owner);
  if (dir.exists) dir.delete();
}
