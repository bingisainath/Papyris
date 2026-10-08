// src/components/MediaViewer.tsx
// Full-screen photos and videos of a chat: swipe between them, Save and Forward.
import React, { useRef, useState } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Download, Forward, X } from 'lucide-react-native';
import Video from 'react-native-video';
import { Lock } from 'lucide-react-native';
import { useMediaSrc } from '../crypto/media';
import { saveToPhone } from '../utils/save';
import { clockTime } from '../utils/time';

export interface ViewerItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  filename?: string;
  senderName?: string;
  timestamp: string;
  mediaKey?: string; // end-to-end encrypted: decrypted on the phone
  mediaMime?: string;
  mediaV2?: { sha256: string; size: number };
}

interface Props {
  items: ViewerItem[];
  index: number | null;
  onClose: () => void;
  onForward?: (id: string) => void;
}

const MediaViewer: React.FC<Props> = ({ items, index, onClose, onForward }) => {
  const { width, height } = useWindowDimensions();
  const [current, setCurrent] = useState(index ?? 0);
  const list = useRef<FlatList<ViewerItem>>(null);
  const item = items[current];

  const save = async () => {
    if (!item) return;
    try {
      await saveToPhone(item.url, item.filename || (item.type === 'video' ? 'video.mp4' : 'photo.jpg'), item.mediaKey, item.mediaMime, item.mediaV2);
    } catch {
      Alert.alert("Couldn't save it", 'Check your connection and try again.');
    }
  };

  return (
    <Modal visible={index !== null} transparent={false} animationType="fade" onRequestClose={onClose} onShow={() => setCurrent(index ?? 0)}>
      <View style={styles.backdrop}>
        <FlatList
          ref={list}
          data={items}
          horizontal
          pagingEnabled
          initialScrollIndex={index ?? 0}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(i) => i.id}
          onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item: media, index: i }) => (
            // Only the photo on screen and its neighbours load (videos only when shown)
            <ViewerPage media={media} width={width} height={height} active={i === current} near={Math.abs(i - current) <= 1} />
          )}
        />
        <SafeAreaView style={styles.top} edges={['top']}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.icon} accessibilityLabel="Close"><X size={24} color="#fff" /></Pressable>
          <View style={styles.title}>
            <Text style={styles.name} numberOfLines={1}>{item?.senderName || ''}</Text>
            <Text style={styles.sub}>{item ? clockTime(item.timestamp) : ''}{items.length > 1 ? ` · ${current + 1} of ${items.length}` : ''}</Text>
          </View>
          {onForward && item && (
            <Pressable onPress={() => onForward(item.id)} hitSlop={10} style={styles.icon} accessibilityLabel="Forward"><Forward size={22} color="#fff" /></Pressable>
          )}
          <Pressable onPress={save} hitSlop={10} style={styles.icon} accessibilityLabel="Save to phone"><Download size={22} color="#fff" /></Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const ViewerPage: React.FC<{ media: ViewerItem; width: number; height: number; active: boolean; near: boolean }> = ({ media, width, height, active, near }) => {
  const load = media.type === 'video' ? active : near;
  const { src, failed } = useMediaSrc(load ? media.url : undefined, media.mediaKey, media.mediaMime, media.mediaV2);
  return (
    <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
      {!src ? (
        <View style={styles.pending}>
          <Lock size={20} color="rgba(255,255,255,0.7)" />
          <Text style={styles.sub}>{failed ? "Couldn't decrypt it" : load ? 'Decrypting…' : ''}</Text>
        </View>
      ) : media.type === 'video' ? (
        <Video source={{ uri: src }} style={{ width, height: height * 0.75 }} controls resizeMode="contain" paused={!active} />
      ) : (
        <Image source={{ uri: src }} style={{ width, height: height * 0.8 }} resizeMode="contain" />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  pending: { alignItems: 'center', gap: 8 },
  backdrop: { flex: 1, backgroundColor: '#000' },
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8, backgroundColor: 'rgba(0,0,0,0.45)' },
  icon: { padding: 10 },
  title: { flex: 1 },
  name: { color: '#fff', fontSize: 15, fontWeight: '600' },
  sub: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
});

export default MediaViewer;
