// src/hooks/useVoiceRecorder.ts
// Records a voice note in the browser (MediaRecorder). Chrome/Firefox give webm/opus, Safari mp4/aac.

import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_SECONDS = 5 * 60;
const TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];
const EXTENSIONS: Record<string, string> = { 'audio/webm': 'weba', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a' };

export type RecorderState = 'idle' | 'recording';

export function useVoiceRecorder(onFinished: (file: File, seconds: number) => void) {
  const [state, setState] = useState<RecorderState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const discard = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const finished = useRef(onFinished);
  finished.current = onFinished;

  const cleanup = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    recorder.current?.stream.getTracks().forEach((track) => track.stop());
    recorder.current = null;
    setState('idle');
    setSeconds(0);
  }, []);

  const stop = useCallback((send: boolean) => {
    discard.current = !send;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    else cleanup();
  }, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice notes are not supported in this browser');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Allow microphone access to record a voice note');
      return;
    }
    const mimeType = TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunks.current = [];
    discard.current = false;
    rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    rec.onstop = () => {
      const elapsed = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
      const type = (rec.mimeType || mimeType || 'audio/webm').split(';')[0];
      const blob = new Blob(chunks.current, { type });
      cleanup();
      if (discard.current || blob.size === 0 || elapsed < 1) return;
      const file = new File([blob], `voice-note-${Date.now()}.${EXTENSIONS[type] || 'weba'}`, { type });
      finished.current(file, elapsed);
    };
    recorder.current = rec;
    startedAt.current = Date.now();
    rec.start(250);
    setState('recording');
    timer.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt.current) / 1000);
      setSeconds(elapsed);
      if (elapsed >= MAX_SECONDS) stop(true); // long enough: send what we have
    }, 250);
  }, [cleanup, stop]);

  useEffect(() => () => { discard.current = true; recorder.current?.stop(); cleanup(); }, [cleanup]);

  return { state, seconds, error, start, stop, maxSeconds: MAX_SECONDS };
}
