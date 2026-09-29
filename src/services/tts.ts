/**
 * น้องกล้า's voice on the phone: the phone's own Thai text-to-speech voice
 * (Google on Android, Apple on iOS) through expo-speech.
 *
 * The native module is looked up optionally, like the speech recognizer:
 * app builds made before it was added do not have it, and an over-the-air
 * update must not crash them. There น้องกล้า still talks with subtitles and
 * a moving mouth, just without sound. The web version is tts.web.ts.
 */
import { requireOptionalNativeModule } from 'expo';

interface Subscription {
  remove(): void;
}
interface NativeVoice {
  identifier: string;
  name: string;
  quality: string;
  language: string;
}
interface NativeTts {
  speak(id: string, text: string, options: Record<string, unknown>): unknown;
  stop(): Promise<void>;
  getVoices?(): Promise<NativeVoice[]>;
  addListener(event: string, listener: (e: { id?: string }) => void): Subscription;
}

const Tts = requireOptionalNativeModule<NativeTts>('ExpoSpeech');

export interface SayHandlers {
  /** Called once, when the piece has been said (or could not be). */
  onDone(): void;
}

/** A calm, friendly way of speaking: a little slower and a little lower than normal. */
const RATE = 0.9;
const PITCH = 0.95;

let voicePick: Promise<string | null> | null = null;

/** The Thai voice to use, or null when this phone cannot speak Thai. */
export function thaiVoice(): Promise<string | null> {
  if (!Tts?.getVoices) return Promise.resolve(null);
  voicePick ??= Tts.getVoices()
    .then((voices) => {
      const thai = voices.filter((v) => v.language?.toLowerCase().replace('_', '-').startsWith('th'));
      if (!thai.length) return null;
      // Better quality first, then voices that work without the internet.
      const score = (v: NativeVoice) => (v.quality === 'Enhanced' ? 2 : 0) + (/network/i.test(v.identifier) ? 0 : 1);
      return [...thai].sort((a, b) => score(b) - score(a))[0].identifier;
    })
    .catch(() => null);
  return voicePick;
}

let seq = 0;

/** Say one short piece of Thai text. Returns a function that stops it. */
export function say(text: string, h: SayHandlers): () => void {
  if (!Tts) {
    h.onDone();
    return () => {};
  }
  const id = `kla${++seq}`;
  let finished = false;
  const subs: Subscription[] = [];
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(guard);
    subs.splice(0).forEach((s) => s.remove());
    h.onDone();
  };
  const mine = (e: { id?: string }) => e?.id === id && finish();
  subs.push(
    Tts.addListener('Exponent.speakingDone', mine),
    Tts.addListener('Exponent.speakingStopped', mine),
    Tts.addListener('Exponent.speakingError', mine),
  );
  // Never wait forever if the phone's voice does not report back.
  const guard = setTimeout(finish, 4000 + text.length * 160);
  thaiVoice()
    .then((voice) => {
      if (finished) return;
      // "th", not "th-TH": Android builds its Locale from the whole string, and "th-TH" is not a language code there.
      return Tts.speak(id, text, { language: 'th', rate: RATE, pitch: PITCH, ...(voice ? { voice } : {}) });
    })
    .catch(finish);
  return () => {
    if (finished) return;
    Tts.stop().catch(() => {});
    finish();
  };
}

/** Stop talking at once. */
export function hush() {
  Tts?.stop().catch(() => {});
}
