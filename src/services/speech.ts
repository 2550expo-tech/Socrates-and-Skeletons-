/**
 * Speech to text on the phone ("พูดจด"), in Thai, with the phone's own speech
 * recognizer (Google on Android, Apple on iOS) through expo-speech-recognition.
 *
 * The native module is looked up optionally: app builds made before it was
 * added do not have it, and an over-the-air update must not crash them. There
 * the voice screen simply offers typing instead (the keyboard's own mic works).
 * The web version is speech.web.ts.
 */
import { requireOptionalNativeModule } from 'expo';

interface Subscription {
  remove(): void;
}
interface NativeSpeech {
  start(options: Record<string, unknown>): void;
  stop(): void;
  abort(): void;
  requestPermissionsAsync(): Promise<{ granted: boolean; canAskAgain?: boolean }>;
  isRecognitionAvailable(): boolean;
  addListener(event: string, listener: (e: never) => void): Subscription;
}

const Speech = requireOptionalNativeModule<NativeSpeech>('ExpoSpeechRecognition');

export interface ListenHandlers {
  /** What was heard so far (`final` once the sentence is finished). */
  onText(text: string, final: boolean): void;
  onError(code: string): void;
  onEnd(): void;
  /** Loudness from about 0 (quiet) to 1 (loud), for the animation. */
  onVolume?(level: number): void;
}

/** Words that help the recognizer with money talk. */
const HINTS = ['บาท', 'ค่ารถ', 'ค่าข้าว', 'ข้าว', 'กาแฟ', 'ชานม', 'ค่าหอ', 'ค่าเน็ต', 'เงินเดือน', 'ได้เงินจากแม่', 'เซเว่น'];

export function speechAvailable(): boolean {
  try {
    return !!Speech && Speech.isRecognitionAvailable();
  } catch {
    return false;
  }
}

export async function askMicPermission(): Promise<'granted' | 'denied' | 'blocked'> {
  if (!Speech) return 'denied';
  try {
    const r = await Speech.requestPermissionsAsync();
    if (r.granted) return 'granted';
    return r.canAskAgain === false ? 'blocked' : 'denied';
  } catch {
    return 'denied';
  }
}

/** Start listening; returns a function that stops (the text heard so far is kept). */
export function listen(h: ListenHandlers): () => void {
  if (!Speech) {
    h.onError('unavailable');
    return () => {};
  }
  const subs: Subscription[] = [];
  const done = () => subs.splice(0).forEach((s) => s.remove());
  subs.push(
    Speech.addListener('result', (e: { isFinal?: boolean; results?: { transcript?: string }[] }) =>
      h.onText(e.results?.[0]?.transcript ?? '', !!e.isFinal),
    ),
    Speech.addListener('error', (e: { error?: string }) => h.onError(e.error ?? 'unknown')),
    Speech.addListener('volumechange', (e: { value?: number }) => h.onVolume?.(Math.max(0, Math.min(1, ((e.value ?? -2) + 2) / 12)))),
    Speech.addListener('end', () => {
      done();
      h.onEnd();
    }),
  );
  try {
    Speech.start({
      lang: 'th-TH',
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
      contextualStrings: HINTS,
      volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
    });
  } catch {
    done();
    h.onError('unavailable');
  }
  return () => {
    try {
      Speech.stop();
    } catch {
      // Already stopped.
    }
  };
}
