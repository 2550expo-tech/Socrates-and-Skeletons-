/**
 * Makes น้องกล้า talk: cuts what it says into short subtitles, says each one
 * aloud with the phone's Thai voice (when there is one and the sound is on),
 * and reports which subtitle is being said so the big character can move its
 * mouth. Without sound each subtitle stays for its reading time instead.
 *
 * The sound setting (เปิด/ปิดเสียงน้องกล้า) is kept on the phone.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, AppState, Platform } from 'react-native';
import { Storage } from '../../data/storage';
import { speakable, talkChunks, talkMs } from '../../domain/klaTalk';
import { hush, say, thaiVoice } from '../../services/tts';

// ---------------------------------------------------------------------------
// Sound on/off, one shared setting
// ---------------------------------------------------------------------------

const KEY = 'mindpay.klaVoice';
let soundOn = true;
let loaded = false;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => soundOn;

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const saved = await Storage.getItem(KEY);
    if (saved === 'off' || saved === 'on') {
      soundOn = saved === 'on';
      listeners.forEach((l) => l());
    }
  } catch {
    // Sound stays on.
  }
}

export function setKlaSound(on: boolean) {
  soundOn = on;
  listeners.forEach((l) => l());
  Storage.setItem(KEY, on ? 'on' : 'off').catch(() => {});
  if (!on) hush();
}

export function useKlaSound(): boolean {
  const on = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    load();
  }, []);
  return on;
}

// ---------------------------------------------------------------------------
// Talking
// ---------------------------------------------------------------------------

export interface Subtitle {
  text: string;
  /** Which piece of the whole message (from 0) and how many pieces there are. */
  index: number;
  total: number;
}

export function useKlaTalk() {
  const sound = useKlaSound();
  const [voice, setVoice] = useState<string | null | undefined>(undefined);
  const [subtitle, setSubtitle] = useState<Subtitle | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const run = useRef(0);
  const cancel = useRef<() => void>(() => {});
  const pause = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  useEffect(() => {
    let alive = true;
    thaiVoice().then((v) => alive && setVoice(v));
    return () => {
      alive = false;
    };
  }, []);

  // With a screen reader on, the subtitles are read by the reader itself, so น้องกล้า stays quiet.
  // (Phones only: browsers cannot tell, and react-native-web always answers "on".)
  const readerRef = useRef(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((on) => {
        readerRef.current = on;
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (on: boolean) => {
      readerRef.current = on;
    });
    return () => sub.remove();
  }, []);

  const stop = useCallback(() => {
    run.current++;
    if (pause.current) clearTimeout(pause.current);
    cancel.current();
    cancel.current = () => {};
    setSubtitle(null);
  }, []);

  /** Say a message. `onDone` runs when all of it has been said (not when stopped). */
  const speak = useCallback(
    (text: string, onDone?: () => void) => {
      stop();
      const mine = run.current;
      const pieces = talkChunks(text);
      setSaid(text);
      let i = 0;
      const next = () => {
        if (run.current !== mine) return;
        if (i >= pieces.length) {
          setSubtitle(null);
          onDone?.();
          return;
        }
        const piece = pieces[i];
        setSubtitle({ text: piece, index: i, total: pieces.length });
        i++;
        const after = () => {
          if (run.current !== mine) return;
          // A short breath between pieces.
          pause.current = setTimeout(next, 160);
        };
        const quietly = () => {
          const t = setTimeout(after, talkMs(piece));
          cancel.current = () => clearTimeout(t);
        };
        if (!soundRef.current || readerRef.current) {
          quietly();
          return;
        }
        // Wait for the voice check (it is done once), so even the first words are heard.
        cancel.current = () => {};
        thaiVoice()
          .then((v) => {
            setVoice(v);
            if (run.current !== mine) return;
            if (v) cancel.current = say(speakable(piece), { onDone: after });
            else quietly();
          })
          .catch(quietly);
      };
      next();
    },
    [stop],
  );

  // Stop talking when the screen goes away or the app goes to the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stop();
    });
    return () => {
      sub.remove();
      stop();
    };
  }, [stop]);

  return {
    /** The piece being said right now (null when quiet). */
    subtitle,
    talking: subtitle !== null,
    /** The last whole message. */
    said,
    speak,
    stop,
    sound,
    /** undefined while checking; null when this phone has no Thai voice. */
    voice,
  };
}
