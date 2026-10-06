// src/components/MessageBubble.tsx
import React from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, CheckCheck, Clock, FileText, Mic, Play, ReceiptText, RotateCw, XCircle } from 'lucide-react-native';
import { mediaUrl } from '../config';
import type { Message } from '../api/chat';
import { colors, radius, space } from '../theme';
import { clockTime } from '../utils/time';
import Avatar from './Avatar';

interface Props {
  message: Message;
  mine: boolean;
  showSender: boolean; // group chats: name + avatar on others' messages
  currentUserId: string;
  onLongPress: () => void;
  onReact: (emoji: string) => void;
  onRetry: () => void;
  onOpenImage: () => void;
  onOpenExpense: (expenseId: string) => void;
  onJumpToReply: (messageId: string) => void;
}

const MessageBubble: React.FC<Props> = ({
  message: m, mine, showSender, currentUserId, onLongPress, onReact, onRetry, onOpenImage, onOpenExpense, onJumpToReply,
}) => {
  if (m.messageType === 'system') {
    if (m.expenseId) {
      return (
        <Pressable onPress={() => onOpenExpense(m.expenseId!)} style={styles.expenseCard} accessibilityLabel={`Expense: ${m.text}`}>
          <View style={styles.expenseIcon}><ReceiptText size={18} color={colors.primary700} /></View>
          <Text style={styles.expenseText}>{m.text}</Text>
        </Pressable>
      );
    }
    return <Text style={styles.system}>{m.text}</Text>;
  }

  const fg = mine ? colors.white : colors.muted900;
  const sub = mine ? 'rgba(255,255,255,0.75)' : colors.muted400;
  const status = mine && !m.isDeleted ? statusIcon(m.status) : null;

  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
      {showSender && !mine && <Avatar uri={m.senderAvatar} name={m.senderName} size={28} />}
      <View style={[styles.column, mine ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
        <Pressable
          onLongPress={m.isDeleted || m.id.startsWith('temp-') ? undefined : onLongPress}
          delayLongPress={300}
          style={[styles.bubble, mine ? styles.mine : styles.other]}
          accessibilityHint="Long press for options"
        >
          {showSender && !mine && m.senderName && <Text style={styles.sender}>{m.senderName}</Text>}

          {m.isDeleted ? (
            <View style={styles.inline}>
              <XCircle size={14} color={sub} />
              <Text style={[styles.deleted, { color: sub }]}>{mine ? 'You deleted this message' : 'This message was deleted'}</Text>
            </View>
          ) : (
            <>
              {m.replyTo && (
                <Pressable onPress={() => onJumpToReply(m.replyTo!.id)} style={[styles.quote, mine ? styles.quoteMine : styles.quoteOther]}>
                  <Text style={[styles.quoteName, { color: mine ? colors.white : colors.primary700 }]} numberOfLines={1}>
                    {m.replyTo.senderId === currentUserId ? 'You' : m.replyTo.senderName || 'Message'}
                  </Text>
                  <Text style={[styles.quoteText, { color: mine ? 'rgba(255,255,255,0.85)' : colors.muted600 }]} numberOfLines={2}>{m.replyTo.text}</Text>
                </Pressable>
              )}

              {m.mediaUrl && m.mediaType === 'image' && (
                <Pressable onPress={onOpenImage} style={styles.media} accessibilityLabel="Open photo">
                  <Image
                    source={{ uri: mediaUrl(m.mediaUrl) }}
                    style={[styles.image, m.mediaWidth && m.mediaHeight ? { aspectRatio: m.mediaWidth / m.mediaHeight } : { height: 200 }]}
                    resizeMode="cover"
                  />
                </Pressable>
              )}
              {m.mediaUrl && m.mediaType !== 'image' && (
                // Videos, voice notes and files open in the phone's viewer for now
                <Pressable onPress={() => Linking.openURL(mediaUrl(m.mediaUrl)!)} style={[styles.file, mine ? styles.fileMine : styles.fileOther]}>
                  {m.mediaType === 'video' ? <Play size={20} color={fg} /> : m.mediaType === 'audio' ? <Mic size={20} color={fg} /> : <FileText size={20} color={fg} />}
                  <Text style={[styles.fileName, { color: fg }]} numberOfLines={1}>
                    {m.mediaType === 'video' ? 'Video' : m.mediaType === 'audio' ? 'Voice message' : m.mediaFilename || 'File'}
                  </Text>
                </Pressable>
              )}

              {!!m.text && <Text style={[styles.text, { color: fg }]}>{m.text}</Text>}
            </>
          )}

          <View style={styles.meta}>
            {m.editedAt && !m.isDeleted && <Text style={[styles.metaText, { color: sub }]}>edited</Text>}
            <Text style={[styles.metaText, { color: sub }]}>{clockTime(m.timestamp)}</Text>
            {status}
          </View>
        </Pressable>

        {m.status === 'failed' && mine && (
          <Pressable onPress={onRetry} style={styles.retry} hitSlop={6}>
            <RotateCw size={12} color={colors.danger600} />
            <Text style={styles.retryText}>Not sent · Tap to retry</Text>
          </Pressable>
        )}

        {m.reactions.length > 0 && !m.isDeleted && (
          <View style={styles.reactions}>
            {m.reactions.map((r) => {
              const own = r.userIds.includes(currentUserId);
              return (
                <Pressable key={r.emoji} onPress={() => onReact(r.emoji)} style={[styles.reaction, own && styles.reactionOwn]}
                  accessibilityLabel={`${r.emoji} ${r.userIds.length}${own ? ', yours' : ''}`}>
                  <Text style={styles.reactionText}>{r.emoji}{r.userIds.length > 1 ? ` ${r.userIds.length}` : ''}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
};

function statusIcon(status: Message['status']) {
  const muted = 'rgba(255,255,255,0.75)';
  switch (status) {
    case 'sending': return <Clock size={13} color={muted} />;
    case 'sent': return <Check size={14} color={muted} />;
    case 'delivered': return <CheckCheck size={14} color={muted} />;
    case 'read': return <CheckCheck size={14} color="#c9bfe6" />;
    case 'failed': return <XCircle size={13} color="#f6c3cb" />;
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space(2), marginVertical: 3, paddingHorizontal: space(3) },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  column: { maxWidth: '80%' },
  bubble: { paddingHorizontal: space(3), paddingTop: space(2), paddingBottom: space(1.5), borderRadius: radius.lg },
  mine: { backgroundColor: colors.primary700, borderBottomRightRadius: 4 },
  other: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.muted200, borderBottomLeftRadius: 4 },
  sender: { fontSize: 12, fontWeight: '700', color: colors.primary700, marginBottom: 2 },
  text: { fontSize: 15.5, lineHeight: 21 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  deleted: { fontStyle: 'italic', fontSize: 14 },
  quote: { borderLeftWidth: 3, borderRadius: radius.sm, paddingHorizontal: space(2), paddingVertical: space(1), marginBottom: space(1.5) },
  quoteMine: { backgroundColor: 'rgba(255,255,255,0.15)', borderLeftColor: 'rgba(255,255,255,0.7)' },
  quoteOther: { backgroundColor: colors.muted50, borderLeftColor: colors.primary500 },
  quoteName: { fontSize: 12, fontWeight: '700' },
  quoteText: { fontSize: 13 },
  media: { borderRadius: radius.md, overflow: 'hidden', marginBottom: space(1), width: 220 },
  image: { width: 220, maxHeight: 320, backgroundColor: colors.muted100 },
  file: { flexDirection: 'row', alignItems: 'center', gap: space(2), padding: space(2.5), borderRadius: radius.md, marginBottom: space(1), minWidth: 180 },
  fileMine: { backgroundColor: 'rgba(255,255,255,0.15)' },
  fileOther: { backgroundColor: colors.muted100 },
  fileName: { flexShrink: 1, fontSize: 14, fontWeight: '500' },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 },
  metaText: { fontSize: 10.5 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  retryText: { fontSize: 12, color: colors.danger600 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: -4 },
  reaction: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.muted200 },
  reactionOwn: { backgroundColor: colors.primary50, borderColor: colors.primary300 },
  reactionText: { fontSize: 13 },
  system: { alignSelf: 'center', marginVertical: space(2), paddingHorizontal: space(3), paddingVertical: space(1), backgroundColor: colors.muted100, borderRadius: radius.full, fontSize: 12, color: colors.muted600, textAlign: 'center', maxWidth: '85%' },
  expenseCard: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: space(2.5), marginVertical: space(2), padding: space(3), maxWidth: '88%', backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.primary200 },
  expenseIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary50, alignItems: 'center', justifyContent: 'center' },
  expenseText: { flexShrink: 1, fontSize: 14, color: colors.muted900 },
});

export default React.memo(MessageBubble);
