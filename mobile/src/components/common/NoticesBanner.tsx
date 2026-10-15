// src/components/common/NoticesBanner.tsx
// Above the chat list while a notice from the ShareEven team is unread (opens Settings → Notices).
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { CircleAlert, MessageSquareText } from 'lucide-react-native';
import { useNotices } from '../../store/notices';
import { colors, radius, space } from '../../theme';

const NoticesBanner: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const { notices, unread, loaded, load } = useNotices();
  useEffect(() => { if (!loaded) load(); }, [loaded, load]);
  if (!unread) return null;
  const warning = notices.some((n) => !n.read && n.kind === 'warning');
  const text = warning
    ? 'You have a warning from the ShareEven team'
    : `${unread === 1 ? 'A notice' : `${unread} notices`} from the ShareEven team`;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${text}. Read`}
      style={({ pressed }) => [styles.banner, warning ? styles.warning : styles.info, pressed && { opacity: 0.85 }]}>
      {warning ? <CircleAlert size={18} color={colors.warning700} /> : <MessageSquareText size={18} color={colors.primary700} />}
      <Text style={[styles.text, { color: warning ? colors.warning700 : colors.primary800 }]}>{text}</Text>
      <Text style={[styles.read, { color: warning ? colors.warning700 : colors.primary700 }]}>Read</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: space(2.5), marginHorizontal: space(4), marginBottom: space(2),
    paddingHorizontal: space(3.5), paddingVertical: space(2.5), borderRadius: radius.md,
  },
  warning: { backgroundColor: colors.warning50 },
  info: { backgroundColor: colors.primary50 },
  text: { flex: 1, fontSize: 14, fontWeight: '500' },
  read: { fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
});

export default NoticesBanner;
