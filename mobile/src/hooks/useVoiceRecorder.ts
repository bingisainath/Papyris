// src/hooks/useVoiceRecorder.ts
// Records a voice note (AAC in an MP4/M4A file on both platforms, which the server accepts as audio/mp4).
import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { createSound } from 'react-native-nitro-sound';

const MAX_SECONDS = 5 * 60;

export function useVoiceRecorder(onFinished: (file: { uri: string; seconds: number }) => void) {
  const sound = useRef(createSound()).current;
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef(0);
  const done = useRef(onFinished);
  done.current = onFinished;

  const stop = useCallback(async (send: boolean) => {
    sound.removeRecordBackListener();
    let uri = '';
    try {
      uri = await sound.stopRecorder();
    } catch {
      // already stopped
    }
    setRecording(false);
    setSeconds(0);
    const elapsed = Math.round((Date.now() - startedAt.current) / 1000);
    if (send && uri && elapsed >= 1) done.current({ uri: uri.startsWith('file://') ? uri : `file://${uri}`, seconds: elapsed });
  }, [sound]);

  const start = useCallback(async (): Promise<string | null> => {
    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (result !== PermissionsAndroid.RESULTS.GRANTED) return 'Allow microphone access to record a voice message';
    }
    try {
      sound.addRecordBackListener((meta) => {
        const secs = Math.floor(meta.currentPosition / 1000);
        setSeconds(secs);
        if (secs >= MAX_SECONDS) stop(true); // long enough: send what we have
      });
      await sound.startRecorder();
      startedAt.current = Date.now();
      setRecording(true);
      return null;
    } catch {
      sound.removeRecordBackListener();
      return "Couldn't start recording";
    }
  }, [sound, stop]);

  useEffect(() => () => { if (recording) stop(false); }, [recording, stop]);

  return { recording, seconds, start, stop };
}
