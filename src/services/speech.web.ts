/**
 * Speech to text on the web ("พูดจด"), with the browser's Web Speech API in
 * Thai (Chrome and Edge on computers and Android; Safari on iPhone asks to use
 * the mic and Siri's recognizer). Browsers without it get typing instead.
 */
import type { ListenHandlers } from './speech';

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

const Ctor: (new () => Recognition) | undefined =
  typeof window === 'undefined'
    ? undefined
    : ((window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition);

export type { ListenHandlers };

export function speechAvailable(): boolean {
  return !!Ctor;
}

/** The browser asks for the mic itself when listening starts. */
export async function askMicPermission(): Promise<'granted' | 'denied' | 'blocked'> {
  return Ctor ? 'granted' : 'denied';
}

export function listen(h: ListenHandlers): () => void {
  if (!Ctor) {
    h.onError('unavailable');
    return () => {};
  }
  const rec = new Ctor();
  rec.lang = 'th-TH';
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  rec.onresult = (e) => {
    let text = '';
    let final = true;
    for (let i = 0; i < e.results.length; i++) {
      text += e.results[i][0]?.transcript ?? '';
      if (!e.results[i].isFinal) final = false;
    }
    h.onText(text, final);
  };
  rec.onerror = (e) => h.onError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'not-allowed' : e.error);
  rec.onend = () => h.onEnd();
  try {
    rec.start();
  } catch {
    h.onError('unavailable');
  }
  return () => {
    try {
      rec.stop();
    } catch {
      // Already stopped.
    }
  };
}
