// src/screens/chats/ChatScreen.tsx
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Modal, Platform, Pressable, StyleSheet, Text, View,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Copy, CornerUpLeft, Download, Forward as ForwardIcon, Info, Lock, LockOpen, Pencil, ReceiptText, Trash2, X } from 'lucide-react-native';
import { useChatEncryption } from '../../crypto/useChatEncryption';
import { SafeAreaView } from 'react-native-safe-area-context';
import Avatar from '../../components/Avatar';
import MessageBubble from '../../components/MessageBubble';
import AlbumGrid, { groupAlbums } from '../../components/AlbumGrid';
import Composer from '../../components/Composer';
import ForwardSheet from '../../components/ForwardSheet';
import MediaViewer, { ViewerItem } from '../../components/MediaViewer';
import { saveToPhone } from '../../utils/save';
import { chatApi, Message, ReplyPreview } from '../../api/chat';
import { errorMessage } from '../../api/client';
import { useKeyboardOffset } from '../../hooks/useKeyboardOffset';
import { useAuth } from '../../store/auth';
import { mediaPayloadOf, typingNames, useChat } from '../../store/chat';
import { sealFor } from '../../crypto/messages';
import { editV2 } from '../../crypto/v2-platform/chat';
import { socket } from '../../ws/socket';
import { colors, radius, space } from '../../theme';
import { dayLabel } from '../../utils/time';
import type { AppStackParams } from '../../navigation/types';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const TYPING_REPEAT_MS = 2500;
const EMPTY: Message[] = [];

type Row = { kind: 'message'; message: Message } | { kind: 'album'; messages: Message[] } | { kind: 'day'; label: string; key: string };

const preview = (m: Message) =>
  m.text || (m.mediaType === 'image' ? 'Photo' : m.mediaType === 'video' ? 'Video' : m.mediaType === 'audio' ? 'Voice message' : m.mediaFilename || 'File');

const ChatScreen: React.FC<NativeStackScreenProps<AppStackParams, 'Chat'>> = ({ route, navigation }) => {
  const { conversationId } = route.params;
  const me = useAuth((s) => s.user)!;
  const conversation = useChat((s) => s.conversations.find((c) => c.id === conversationId));
  const messages = useChat((s) => s.messages[conversationId] ?? EMPTY);
  const hasMore = useChat((s) => !!s.hasMore[conversationId]);
  const typing = useChat((s) => s.typing);
  const online = useChat((s) => s.online);
  const { open, loadMessages, loadOlder, send, retry, sendMedia, cancelUpload, retryUpload, forward } = useChat.getState();

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ReplyPreview | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [selected, setSelected] = useState<Message | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [forwarding, setForwarding] = useState<Message | null>(null);
  const [loading, setLoading] = useState(!messages.length);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const lastTypingSent = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const list = useRef<FlatList<Row>>(null);
  const keyboard = useKeyboardOffset(); // keeps the composer right above the keyboard

  // Join the room while the chat is on screen
  useFocusEffect(useCallback(() => {
    open(conversationId);
    loadMessages(conversationId).catch((e) => Alert.alert("Couldn't load messages", errorMessage(e))).finally(() => setLoading(false));
    return () => open(null);
  }, [conversationId, open, loadMessages]));

  // Tell the server we've read up to the newest message from someone else
  const latestFromOthers = useMemo(() => [...messages].reverse().find((m) => m.senderId !== me.id && !m.id.startsWith('temp-')), [messages, me.id]);
  useEffect(() => {
    if (latestFromOthers) socket.read(conversationId, latestFromOthers.id);
  }, [latestFromOthers, conversationId]);

  const otherId = conversation && !conversation.isGroup ? conversation.members.find((id) => id !== me.id) : undefined;
  const typers = typingNames(typing, conversationId).filter(Boolean);
  const status = typers.length
    ? conversation?.isGroup ? `${typers.length > 1 ? `${typers.length} people are` : `${typers[0]} is`} typing…` : 'typing…'
    : conversation?.isGroup ? `${conversation.members.length} members` : otherId && online.includes(otherId) ? 'Online' : 'Offline';

  const encryption = useChatEncryption(conversationId);
  const encrypted = encryption.state === 'encrypted';

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <Pressable onPress={() => navigation.navigate('ChatInfo', { conversationId })} style={styles.headerTitle} accessibilityLabel="Chat info">
          <Avatar uri={conversation?.avatar} name={conversation?.name} size={36} online={!!otherId && online.includes(otherId)} />
          <View style={styles.headerText}>
            <View style={styles.headerNameRow}>
              <Text style={styles.headerName} numberOfLines={1}>{conversation?.name || 'Chat'}</Text>
              {encrypted && <Lock size={12} color={colors.muted400} accessibilityLabel="End-to-end encrypted" />}
            </View>
            <Text style={[styles.headerStatus, typers.length > 0 && { color: colors.primary700 }]} numberOfLines={1}>{status}</Text>
          </View>
        </Pressable>
      ),
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable onPress={() => navigation.navigate('AddExpense', { conversationId })} hitSlop={8} accessibilityLabel="Add expense">
            <ReceiptText size={22} color={colors.primary700} />
          </Pressable>
          <Pressable onPress={() => navigation.navigate('ChatInfo', { conversationId })} hitSlop={8} accessibilityLabel="Chat info">
            <Info size={22} color={colors.primary700} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, conversation, conversationId, status, typers.length, otherId, online, encrypted]);

  // Newest first for the inverted list, with a day label above each day's first message
  const rows = useMemo<Row[]>(() => {
    const items = groupAlbums(messages);
    const firstOf = (item: (typeof items)[number]) => (item.kind === 'album' ? item.messages[0] : item.message);
    const out: Row[] = [];
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      out.push(item);
      const m = firstOf(item);
      const older = items[i - 1] ? firstOf(items[i - 1]) : null;
      if (!older || new Date(older.timestamp).toDateString() !== new Date(m.timestamp).toDateString()) {
        out.push({ kind: 'day', label: dayLabel(m.timestamp), key: `day-${m.timestamp}` });
      }
    }
    return out;
  }, [messages]);

  // Photos and videos of this chat, for the full-screen viewer
  const media = useMemo<ViewerItem[]>(() => messages
    .filter((m) => (m.mediaType === 'image' || m.mediaType === 'video') && m.mediaUrl && !m.isDeleted && !m.id.startsWith('temp-'))
    .map((m) => ({
      id: m.id, url: m.mediaUrl!, type: m.mediaType as 'image' | 'video', filename: m.mediaFilename, mediaKey: m.mediaKey, mediaMime: m.mediaMime, mediaV2: m.mediaV2,
      senderName: m.senderId === me.id ? 'You' : m.senderName, timestamp: m.timestamp,
    })), [messages, me.id]);
  const openMedia = (id: string) => {
    const index = media.findIndex((x) => x.id === id);
    if (index >= 0) setViewerIndex(index);
  };

  const save = async (m: Message) => {
    try {
      await saveToPhone(m.mediaUrl!, m.mediaFilename || `${m.mediaType}-${m.id.slice(0, 8)}`, m.mediaKey, m.mediaMime, m.mediaV2);
      if (Platform.OS === 'android') Alert.alert('Saving to Downloads', 'You\'ll get a notification when it\'s done.');
    } catch {
      Alert.alert("Couldn't save it", 'Check your connection and try again.');
    }
  };

  const onChangeText = (value: string) => {
    setText(value);
    const now = Date.now();
    if (now - lastTypingSent.current > TYPING_REPEAT_MS) {
      socket.typing(conversationId, true);
      lastTypingSent.current = now;
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => { socket.typing(conversationId, false); lastTypingSent.current = 0; }, 2000);
  };

  const submit = async () => {
    const value = text.trim();
    if (typingTimer.current) clearTimeout(typingTimer.current);
    socket.typing(conversationId, false);
    lastTypingSent.current = 0;
    if (editing) {
      const original = editing;
      setEditing(null);
      setText('');
      if (!value || value === original.text) return;
      try {
        if (original.e2eVersion === 2) {
          // v2: the edit is a new encrypted packet to the same devices; the server row doesn't change
          await editV2({ conversationId, isGroup: !!conversation?.isGroup, members: conversation?.members || [] }, original, value);
          useChat.setState((s) => ({ messages: { ...s.messages, [conversationId]: (s.messages[conversationId] || []).map((m) => (m.id === original.id ? { ...m, text: value, editedAt: new Date().toISOString() } : m)) } }));
          return;
        }
        // Encrypted chat (v1): the edit is a new envelope (keeping the attached file's key)
        const sealed = await sealFor(conversationId, { t: value, m: mediaPayloadOf(original) });
        await chatApi.editMessage(original.id, sealed?.text ?? value, sealed?.hasLink);
      } catch (e) {
        Alert.alert("Couldn't edit message", errorMessage(e));
      }
      return;
    }
    if (!value) return;
    send(conversationId, value, { id: me.id, username: me.username }, replyTo);
    setText('');
    setReplyTo(null);
  };

  const react = (message: Message, emoji: string) => {
    chatApi.react(message.id, emoji).catch((e) => Alert.alert("Couldn't react", errorMessage(e)));
  };

  const remove = (message: Message) => {
    Alert.alert('Delete message?', 'It will be deleted for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => chatApi.deleteMessage(message.id).catch((e) => Alert.alert("Couldn't delete", errorMessage(e))),
      },
    ]);
  };

  const jumpTo = (messageId: string) => {
    const index = rows.findIndex((r) => r.kind === 'message' && r.message.id === messageId);
    if (index >= 0) list.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
  };

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'day') return <Text style={styles.day}>{item.label}</Text>;
    if (item.kind === 'album') {
      return <AlbumGrid messages={item.messages} mine={item.messages[0].senderId === me.id} showSender={!!conversation?.isGroup} onOpen={openMedia} />;
    }
    const m = item.message;
    return (
      <MessageBubble
        message={m}
        mine={m.senderId === me.id}
        showSender={!!conversation?.isGroup}
        currentUserId={me.id}
        onLongPress={() => setSelected(m)}
        onReact={(emoji) => react(m, emoji)}
        onRetry={() => retry(conversationId, m.id)}
        onOpenMedia={() => openMedia(m.id)}
        onOpenFile={() => save(m)}
        onCancelUpload={() => cancelUpload(conversationId, m.id)}
        onRetryUpload={() => retryUpload(m.id)}
        onOpenExpense={(expenseId) => navigation.navigate('ExpenseDetail', { expenseId })}
        onJumpToReply={jumpTo}
      />
    );
  };

  const loadMore = async () => {
    if (!hasMore || loadingOlder) return;
    setLoadingOlder(true);
    await loadOlder(conversationId).catch(() => undefined);
    setLoadingOlder(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View ref={keyboard.ref} style={[styles.flex, { paddingBottom: keyboard.offset }]}>
        {encryption.state === 'not-encrypted' && (
          <View style={styles.notEncrypted}>
            <LockOpen size={14} color={colors.warning700} />
            <Text style={styles.notEncryptedText}>
              {conversation?.isGroup
                ? `Not end-to-end encrypted yet: ${encryption.missing.length} member${encryption.missing.length === 1 ? " hasn't" : "s haven't"} set up encryption. New messages will be encrypted once everyone has.`
                : `Not end-to-end encrypted yet: ${conversation?.name || 'they'} hasn't set up encryption. New messages will be encrypted once they do.`}
            </Text>
          </View>
        )}
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary700} /></View>
        ) : (
          <FlatList
            ref={list}
            data={rows}
            inverted
            keyExtractor={(r) => (r.kind === 'day' ? r.key : r.kind === 'album' ? `album-${r.messages[0].id}` : r.message.id)}
            renderItem={renderRow}
            onEndReached={loadMore}
            onEndReachedThreshold={0.3}
            onScrollToIndexFailed={() => undefined}
            ListFooterComponent={loadingOlder ? <ActivityIndicator style={{ margin: space(3) }} color={colors.primary700} /> : null}
            ListEmptyComponent={<Text style={styles.day}>No messages yet. Say hello.</Text>}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          />
        )}

        {(replyTo || editing) && (
          <View style={styles.banner}>
            <View style={styles.flex}>
              <Text style={styles.bannerTitle}>{editing ? 'Editing message' : `Replying to ${replyTo?.senderName || 'message'}`}</Text>
              {!editing && <Text style={styles.bannerText} numberOfLines={1}>{replyTo?.text}</Text>}
            </View>
            <Pressable onPress={() => { setReplyTo(null); if (editing) { setEditing(null); setText(''); } }} hitSlop={10} accessibilityLabel="Cancel">
              <X size={18} color={colors.muted500} />
            </Pressable>
          </View>
        )}

        <Composer
          text={text}
          onChangeText={onChangeText}
          editing={!!editing}
          onSendText={submit}
          onSendAttachments={(attachments) => {
            attachments.forEach((a, i) => sendMedia(conversationId, a, { id: me.id, username: me.username }, i === 0 ? replyTo : null));
            setReplyTo(null);
          }}
          onSendVoice={(a) => { sendMedia(conversationId, a, { id: me.id, username: me.username }, replyTo); setReplyTo(null); }}
        />
      </View>

      {/* Long-press menu */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          {selected && (
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.quickReactions}>
                {QUICK_REACTIONS.map((emoji) => (
                  <Pressable key={emoji} onPress={() => { react(selected, emoji); setSelected(null); }} style={styles.quickReaction} accessibilityLabel={`React ${emoji}`}>
                    <Text style={styles.quickReactionText}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
              <SheetAction icon={CornerUpLeft} label="Reply" onPress={() => {
                setEditing(null);
                setReplyTo({ id: selected.id, text: preview(selected), senderId: selected.senderId, senderName: selected.senderId === me.id ? 'yourself' : selected.senderName });
                setSelected(null);
              }} />
              {!!selected.text && <SheetAction icon={Copy} label="Copy text" onPress={() => { Clipboard.setString(selected.text); setSelected(null); }} />}
              <SheetAction icon={ForwardIcon} label="Forward" onPress={() => { setForwarding(selected); setSelected(null); }} />
              {!!selected.mediaUrl && <SheetAction icon={Download} label="Save to phone" onPress={() => { const m = selected; setSelected(null); save(m); }} />}
              {selected.senderId === me.id && !!selected.text && (
                <SheetAction icon={Pencil} label="Edit" onPress={() => { setReplyTo(null); setEditing(selected); setText(selected.text); setSelected(null); }} />
              )}
              {selected.senderId === me.id && (
                <SheetAction icon={Trash2} label="Delete for everyone" danger onPress={() => { const m = selected; setSelected(null); remove(m); }} />
              )}
            </Pressable>
          )}
        </Pressable>
      </Modal>

      {/* Photos and videos */}
      <MediaViewer
        items={media}
        index={viewerIndex}
        onClose={() => setViewerIndex(null)}
        onForward={(id) => { const m = messages.find((x) => x.id === id); setViewerIndex(null); if (m) setForwarding(m); }}
      />

      <ForwardSheet
        visible={!!forwarding}
        onClose={() => setForwarding(null)}
        onSend={async (ids) => {
          if (!forwarding) return;
          const { sent, skipped } = await forward(forwarding, ids).catch(() => ({ sent: 0, skipped: 0 }));
          const notes = [
            sent ? (sent === 1 ? 'Forwarded' : `Forwarded to ${sent} chats`) : '',
            skipped ? `Not forwarded to ${skipped === 1 ? 'a chat' : `${skipped} chats`} that isn't end-to-end encrypted yet` : '',
          ].filter(Boolean);
          Alert.alert(notes.join('. ') || 'Not connected. Try again.');
        }}
      />
    </SafeAreaView>
  );
};

const SheetAction: React.FC<{ icon: React.ComponentType<{ size?: number; color?: string }>; label: string; onPress: () => void; danger?: boolean }> = ({ icon: Icon, label, onPress, danger }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.muted50 }]}>
    <Icon size={20} color={danger ? colors.danger600 : colors.primary700} />
    <Text style={[styles.actionText, danger && { color: colors.danger600 }]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingVertical: space(3) },
  day: { alignSelf: 'center', marginVertical: space(2), paddingHorizontal: space(3), paddingVertical: 3, borderRadius: radius.full, backgroundColor: colors.muted100, fontSize: 12, color: colors.muted600, overflow: 'hidden' },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: space(2.5), maxWidth: 230 },
  headerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  notEncrypted: { flexDirection: 'row', gap: space(2), paddingHorizontal: space(4), paddingVertical: space(2), backgroundColor: colors.warning50 },
  notEncryptedText: { flex: 1, fontSize: 12, color: colors.warning700 },
  headerText: { flexShrink: 1 },
  headerName: { flexShrink: 1, fontSize: 16, fontWeight: '600', color: colors.muted900 },
  headerStatus: { fontSize: 12, color: colors.muted500 },
  headerActions: { flexDirection: 'row', gap: space(5), alignItems: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginHorizontal: space(3), marginBottom: space(2), padding: space(2.5), borderLeftWidth: 4, borderLeftColor: colors.primary600, backgroundColor: colors.primary50, borderRadius: radius.md },
  bannerTitle: { fontSize: 12, fontWeight: '700', color: colors.primary700 },
  bannerText: { fontSize: 14, color: colors.muted600 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingBottom: space(8), paddingTop: space(3) },
  quickReactions: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: space(4), paddingBottom: space(3), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.muted200 },
  quickReaction: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.muted50 },
  quickReactionText: { fontSize: 24 },
  action: { flexDirection: 'row', alignItems: 'center', gap: space(4), paddingHorizontal: space(6), paddingVertical: space(4) },
  actionText: { fontSize: 16, color: colors.muted900 },
});

export default ChatScreen;
