// src/components/OfflineBanner.tsx
// Shown over the app when the live connection to the server is lost (server down or no internet).
// Waits a few seconds so brief blips and the first connect don't flash it.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff } from 'lucide-react-native';
import { useChat } from '../store/chat';
import { socket } from '../ws/socket';
import { colors, radius, space } from '../theme';

const GRACE_MS = 3000;

const OfflineBanner: React.FC = () => {
  const connected = useChat((s) => s.connected);
  const insets = useSafeAreaInsets();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (connected) { setShow(false); return; }
    const timer = setTimeout(() => setShow(true), GRACE_MS);
    return () => clearTimeout(timer);
  }, [connected]);

  if (!show) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + space(1) }]}>
      <View style={styles.banner} accessibilityRole="alert">
        <WifiOff size={16} color={colors.warning700} />
        <Text style={styles.text}>Can't reach Papyris. Reconnecting…</Text>
        <Pressable onPress={() => socket.retryNow()} style={styles.button} hitSlop={8}>
          <Text style={styles.buttonText}>Try now</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space(3), right: space(3), zIndex: 100 },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(3), paddingVertical: space(2.5),
    borderRadius: radius.md, backgroundColor: colors.warning50, borderWidth: 1, borderColor: '#fde68a',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  text: { flex: 1, fontSize: 13.5, color: colors.warning700 },
  button: { paddingHorizontal: space(2.5), paddingVertical: space(1), borderRadius: radius.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: '#fcd34d' },
  buttonText: { fontSize: 13, fontWeight: '600', color: colors.warning700 },
});

export default OfflineBanner;
