// src/components/EncryptionInfo.tsx
// Chat info: is this chat end-to-end encrypted, and (direct chats) the security code to compare.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Lock, LockOpen } from 'lucide-react-native';
import { publicKeysOf, securityCode } from '../crypto/e2e';
import { e2eSession } from '../crypto/session';
import { useChatEncryption } from '../crypto/useChatEncryption';
import { e2eService } from '../services/e2e.service';
import { colors, space } from '../theme';

const EncryptionInfo: React.FC<{ conversationId: string; otherId?: string; otherName?: string }> = ({ conversationId, otherId, otherName }) => {
  const encryption = useChatEncryption(conversationId);
  const [code, setCode] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    const keys = e2eSession.keys();
    const me = e2eSession.userId();
    if (!otherId || !keys || !me || encryption.state !== 'encrypted') return;
    e2eService.userKeys([otherId]).then((found) => {
      const theirs = found[otherId];
      if (theirs?.enc && theirs.sign) {
        setCode(securityCode({ userId: me, keys: publicKeysOf(keys) }, { userId: otherId, keys: { enc: theirs.enc, sign: theirs.sign } }));
      }
    }).catch(() => undefined);
  }, [otherId, encryption.state]);

  if (encryption.state === 'loading') return null;

  if (encryption.state === 'not-encrypted') {
    return (
      <View style={styles.row}>
        <LockOpen size={20} color={colors.warning700} />
        <View style={styles.flex}>
          <Text style={styles.title}>Not end-to-end encrypted yet</Text>
          <Text style={styles.text}>
            {otherId ? `${otherName || 'They'} hasn't set up encryption.` : `${encryption.missing.length} member${encryption.missing.length === 1 ? " hasn't" : "s haven't"} set up encryption.`}
            {' '}New messages are encrypted once everyone has.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Lock size={20} color={colors.primary700} />
      <View style={styles.flex}>
        <Text style={styles.title}>End-to-end encrypted</Text>
        <Text style={styles.text}>Messages and files here can only be read by the people in this chat.</Text>
        {code && (showCode ? (
          <>
            <Text style={styles.code} selectable>{code}</Text>
            <Text style={styles.text}>
              Compare this code with {otherName || 'them'} in person or on a call. If it matches on both phones, nobody is listening in.
              It changes if either of you starts over with new keys.
            </Text>
          </>
        ) : (
          <Pressable onPress={() => setShowCode(true)} hitSlop={8}>
            <Text style={styles.link}>Verify security code</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space(4), paddingHorizontal: space(4), paddingVertical: space(3.5) },
  flex: { flex: 1 },
  title: { fontSize: 15, color: colors.muted900 },
  text: { fontSize: 12, color: colors.muted500, marginTop: 2 },
  link: { fontSize: 13, color: colors.primary700, fontWeight: '600', marginTop: space(1.5) },
  code: { fontFamily: 'monospace', fontSize: 15, letterSpacing: 1, color: colors.muted900, marginTop: space(2), lineHeight: 22 },
});

export default EncryptionInfo;
