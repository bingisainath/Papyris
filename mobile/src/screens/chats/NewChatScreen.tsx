// src/screens/chats/NewChatScreen.tsx
import React from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import UserSearch from '../../components/UserSearch';
import { chatApi } from '../../api/chat';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../store/auth';
import { useChat } from '../../store/chat';
import { colors } from '../../theme';
import type { AppStackParams } from '../../navigation/types';
import { showAlert } from '../../components/Dialog';

const NewChatScreen: React.FC<NativeStackScreenProps<AppStackParams, 'NewChat'>> = ({ navigation }) => {
  const me = useAuth((s) => s.user)!;
  const conversations = useChat((s) => s.conversations);
  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <UserSearch
        exclude={[me.id]}
        onPick={async (user) => {
          const existing = conversations.find((c) => !c.isGroup && c.members.includes(user.id));
          if (existing) {
            navigation.replace('Chat', { conversationId: existing.id });
            return;
          }
          try {
            const created = await chatApi.createDm(user.id);
            await useChat.getState().loadConversations();
            navigation.replace('Chat', { conversationId: created.id });
          } catch (e) {
            showAlert("Couldn't start the chat", errorMessage(e));
          }
        }}
      />
    </View>
  );
};

export default NewChatScreen;
