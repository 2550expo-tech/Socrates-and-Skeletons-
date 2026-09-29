/**
 * น้องกล้า's voice on the web: the browser's own speech (Web Speech API) with
 * a Thai voice when the computer or phone has one (Edge: Niwat or Premwadee,
 * Safari: Kanya or Narisa, Chrome on Android: Google's Thai voice). Without a
 * Thai voice น้องกล้า talks with subtitles only.
 */
import type { SayHandlers } from './tts';

export type { SayHandlers };

const synth: SpeechSynthesis | undefined = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined;

/** Calm and friendly: a little slower and lower than normal. */
const RATE = 0.95;
const PITCH = 0.95;

/** Voices that sound calm and warm come first. */
const PREFERRED = [/niwat/i, /premwadee/i, /natural/i, /google/i, /narisa/i, /kanya/i, /pattara/i];

let picked: Promise<SpeechSynthesisVoice | null> | null = null;
// Voices can arrive after the page loads (or change): choose again then.
synth?.addEventListener?.('voiceschanged', () => {
  picked = null;
});

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!synth) return Promise.resolve([]);
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices());
    synth.addEventListener?.('voiceschanged', done, { once: true });
    // Some browsers never fire the event when there are no voices.
    setTimeout(done, 1500);
  });
}

function pick(): Promise<SpeechSynthesisVoice | null> {
  picked ??= loadVoices().then((voices) => {
    const thai = voices.filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith('th'));
    if (!thai.length) return null;
    const rank = (v: SpeechSynthesisVoice) => {
      const i = PREFERRED.findIndex((re) => re.test(v.name));
      return i === -1 ? PREFERRED.length : i;
    };
    return [...thai].sort((a, b) => rank(a) - rank(b))[0];
  });
  return picked;
}

export function thaiVoice(): Promise<string | null> {
  return pick().then((v) => v?.name ?? null);
}

export function say(text: string, h: SayHandlers): () => void {
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(guard);
    h.onDone();
  };
  // Browsers sometimes never report the end (e.g. speech blocked before the first tap).
  const guard = setTimeout(finish, 4000 + text.length * 160);
  if (!synth) {
    finish();
    return () => {};
  }
  pick()
    .then((voice) => {
      if (finished) return;
      if (!voice) return finish();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang || 'th-TH';
      u.rate = RATE;
      u.pitch = PITCH;
      u.onend = finish;
      u.onerror = finish;
      synth.speak(u);
    })
    .catch(finish);
  return () => {
    if (finished) return;
    synth.cancel();
    finish();
  };
}

export function hush() {
  synth?.cancel();
}
