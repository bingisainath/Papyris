// src/components/VoiceNote.tsx
// Voice message: play/pause, a tappable progress bar, time and playback speed.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Mic, Pause, Play } from 'lucide-react-native';
import { createSound } from 'react-native-nitro-sound';
import { colors, radius, space } from '../theme';
import { formatDuration } from '../utils/time';

const SPEEDS = [1, 1.5, 2];

const VoiceNote: React.FC<{ uri: string; duration?: number; mine: boolean }> = ({ uri, duration, mine }) => {
  const sound = useRef(createSound()).current;
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [position, setPosition] = useState(0); // seconds
  const [length, setLength] = useState(duration || 0);
  const [speed, setSpeed] = useState(1);
  const [width, setWidth] = useState(1);

  useEffect(() => () => {
    sound.removePlayBackListener();
    sound.removePlaybackEndListener();
    sound.stopPlayer().catch(() => undefined);
  }, [sound]);

  const toggle = async () => {
    try {
      if (playing) {
        await sound.pausePlayer();
        setPlaying(false);
      } else if (started) {
        await sound.resumePlayer();
        setPlaying(true);
      } else {
        sound.addPlayBackListener((meta) => {
          setPosition(meta.currentPosition / 1000);
          if (meta.duration > 0) setLength(meta.duration / 1000);
        });
        sound.addPlaybackEndListener(() => {
          setPlaying(false);
          setStarted(false);
          setPosition(0);
        });
        await sound.startPlayer(uri);
        await sound.setPlaybackSpeed(speed);
        setStarted(true);
        setPlaying(true);
      }
    } catch {
      setPlaying(false);
    }
  };

  const seek = (x: number) => {
    if (!started || !length) return;
    sound.seekToPlayer(Math.max(0, Math.min(1, x / width)) * length * 1000).catch(() => undefined);
  };

  const nextSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (started) sound.setPlaybackSpeed(next).catch(() => undefined);
  };

  const fg = mine ? colors.white : colors.primary700;
  const sub = mine ? 'rgba(255,255,255,0.8)' : colors.muted500;
  const progress = length ? Math.min(1, position / length) : 0;

  return (
    <View style={styles.row}>
      <Pressable onPress={toggle} style={[styles.button, { backgroundColor: mine ? 'rgba(255,255,255,0.2)' : colors.primary50 }]}
        accessibilityLabel={playing ? 'Pause voice message' : 'Play voice message'}>
        {playing ? <Pause size={20} color={fg} fill={fg} /> : <Play size={20} color={fg} fill={fg} />}
      </Pressable>
      <View style={styles.body}>
        <Pressable onLayout={(e) => setWidth(e.nativeEvent.layout.width)} onPress={(e) => seek(e.nativeEvent.locationX)} hitSlop={10}
          style={[styles.track, { backgroundColor: mine ? 'rgba(255,255,255,0.3)' : colors.muted200 }]}>
          <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: fg }]} />
        </Pressable>
        <View style={styles.meta}>
          <View style={styles.time}>
            <Mic size={11} color={sub} />
            <Text style={[styles.metaText, { color: sub }]}>{formatDuration(started ? position : length)}</Text>
          </View>
          <Pressable onPress={nextSpeed} hitSlop={8} style={[styles.speed, { backgroundColor: mine ? 'rgba(255,255,255,0.2)' : colors.muted100 }]}>
            <Text style={[styles.metaText, { color: sub, fontWeight: '700' }]}>{speed}×</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), width: 230, paddingVertical: space(1) },
  button: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space(1.5) },
  time: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11 },
  speed: { paddingHorizontal: 6, borderRadius: radius.sm },
});

export default VoiceNote;
