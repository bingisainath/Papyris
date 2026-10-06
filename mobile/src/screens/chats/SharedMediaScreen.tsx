// src/screens/chats/SharedMediaScreen.tsx
// "Media, links and docs" from chat info: everything shared in the chat, newest first.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Download, FileText, Link2, Play } from 'lucide-react-native';
import MediaViewer, { ViewerItem } from '../../components/MediaViewer';
import VoiceNote from '../../components/VoiceNote';
import { api, errorMessage } from '../../api/client';
import { mediaUrl } from '../../config';
import { useAuth } from '../../store/auth';
import { colors, space } from '../../theme';
import { formatDuration, formatSize } from '../../utils/time';
import { saveToPhone } from '../../utils/save';
import type { AppStackParams } from '../../navigation/types';
import { Segmented } from '../expenses/AddExpenseScreen';

type Kind = 'media' | 'docs' | 'links';
interface Item {
  message_id: string;
  sender_id: string;
  sender_name?: string | null;
  created_at: string;
  media_type?: 'image' | 'video' | 'audio' | 'file';
  media_url?: string;
  media_thumbnail?: string | null;
  media_filename?: string | null;
  media_size?: number | null;
  media_duration?: number | null;
  url?: string;
}

const SharedMediaScreen: React.FC<NativeStackScreenProps<AppStackParams, 'SharedMedia'>> = ({ route }) => {
  const { conversationId } = route.params;
  const me = useAuth((s) => s.user)!;
  const { width } = useWindowDimensions();
  const [kind, setKind] = useState<Kind>('media');
  const [items, setItems] = useState<Item[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewer, setViewer] = useState<number | null>(null);

  const load = useCallback(async (more = false) => {
    setLoading(true);
    try {
      const before = more ? items[items.length - 1]?.created_at : undefined;
      const r = await api.get(`/conversations/${conversationId}/shared`, { params: { kind, before, limit: 60 } });
      setItems((current) => (more ? [...current, ...r.data.data] : r.data.data));
      setHasMore(!!r.data.has_more);
    } catch (e) {
      Alert.alert("Couldn't load", errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [conversationId, kind, items]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setItems([]); load(false); }, [conversationId, kind]);

  const viewerItems: ViewerItem[] = items
    .filter((i) => i.media_type === 'image' || i.media_type === 'video')
    .map((i) => ({
      id: i.message_id, url: i.media_url!, type: i.media_type as 'image' | 'video', filename: i.media_filename || undefined,
      senderName: i.sender_id === me.id ? 'You' : i.sender_name || undefined, timestamp: i.created_at,
    }));
  const tile = (width - 4) / 3;
  const who = (i: Item) => `${i.sender_id === me.id ? 'You' : i.sender_name || 'Someone'} · ${new Date(i.created_at).toLocaleDateString()}`;

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <Segmented value={kind} options={[['media', 'Media'], ['docs', 'Docs'], ['links', 'Links']]} onChange={(v) => setKind(v as Kind)} />
      </View>
      <FlatList
        key={kind}
        data={items}
        numColumns={kind === 'media' ? 3 : 1}
        keyExtractor={(i, n) => `${i.message_id}-${n}`}
        columnWrapperStyle={kind === 'media' ? { gap: 2 } : undefined}
        contentContainerStyle={{ gap: kind === 'media' ? 2 : 0 }}
        onEndReached={() => hasMore && !loading && load(true)}
        ListEmptyComponent={loading ? null : (
          <Text style={styles.empty}>{kind === 'media' ? 'No photos or videos yet' : kind === 'docs' ? 'No documents or voice messages yet' : 'No links yet'}</Text>
        )}
        ListFooterComponent={loading ? <ActivityIndicator style={{ margin: space(6) }} color={colors.primary700} /> : null}
        renderItem={({ item }) => {
          if (kind === 'media') {
            const index = viewerItems.findIndex((v) => v.id === item.message_id);
            return (
              <Pressable onPress={() => setViewer(index)} style={{ width: tile, height: tile, backgroundColor: colors.muted100 }}>
                <Image source={{ uri: mediaUrl(item.media_type === 'video' ? item.media_thumbnail : item.media_url) }} style={{ width: tile, height: tile }} />
                {item.media_type === 'video' && (
                  <View style={styles.videoBadge}><Play size={11} color={colors.white} fill={colors.white} /><Text style={styles.videoText}>{formatDuration(item.media_duration)}</Text></View>
                )}
              </Pressable>
            );
          }
          if (kind === 'links') {
            return (
              <Pressable onPress={() => Linking.openURL(item.url!)} style={styles.row}>
                <View style={styles.icon}><Link2 size={20} color={colors.primary700} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.link} numberOfLines={1}>{item.url}</Text>
                  <Text style={styles.sub}>{who(item)}</Text>
                </View>
              </Pressable>
            );
          }
          return (
            <View style={styles.row}>
              {item.media_type === 'audio' ? (
                <View style={{ flex: 1 }}>
                  <Text style={styles.sub}>{who(item)}</Text>
                  <VoiceNote uri={mediaUrl(item.media_url)!} duration={item.media_duration || undefined} mine={false} />
                </View>
              ) : (
                <>
                  <View style={styles.icon}><FileText size={20} color={colors.primary700} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{item.media_filename || 'File'}</Text>
                    <Text style={styles.sub}>{formatSize(item.media_size)} · {who(item)}</Text>
                  </View>
                  <Pressable onPress={() => saveToPhone(item.media_url!, item.media_filename || 'file').catch(() => Alert.alert("Couldn't save it"))}
                    hitSlop={10} accessibilityLabel="Save to phone">
                    <Download size={20} color={colors.primary700} />
                  </Pressable>
                </>
              )}
            </View>
          );
        }}
      />
      <MediaViewer items={viewerItems} index={viewer} onClose={() => setViewer(null)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  tabs: { alignItems: 'center', paddingVertical: space(3) },
  empty: { textAlign: 'center', color: colors.muted500, marginTop: space(10) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(3), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.muted200 },
  icon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.primary50, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, color: colors.muted900 },
  link: { fontSize: 14, color: colors.primary800 },
  sub: { fontSize: 12, color: colors.muted500, marginTop: 2 },
  videoBadge: { position: 'absolute', left: 4, bottom: 4, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 4, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.6)' },
  videoText: { color: colors.white, fontSize: 10 },
});

export default SharedMediaScreen;
