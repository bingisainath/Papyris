/**
 * Papyris mobile app (React Native).
 * Chats and expenses on the same server as the web app.
 */
import React, { useEffect } from 'react';
import { StatusBar, View } from 'react-native';
import { recordRootHeight } from './src/hooks/useKeyboardOffset';
import { NavigationContainer, DefaultTheme, createNavigationContainerRef } from '@react-navigation/native';
import { onNotificationTap } from './src/notifications/push';
import type { AppStackParams } from './src/navigation/types';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { useAuth } from './src/store/auth';
import { colors } from './src/theme';

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.primary700, background: colors.background, card: colors.white, text: colors.muted900, border: colors.muted200 },
};

export const navigationRef = createNavigationContainerRef<AppStackParams>();

export default function App() {
  const restore = useAuth((s) => s.restore);
  const status = useAuth((s) => s.status);
  useEffect(() => { restore(); }, [restore]);

  // Tapping a message notification opens that chat (once signed in and navigation is ready)
  useEffect(() => {
    if (status !== 'signedIn') return;
    return onNotificationTap((conversationId) => {
      const go = () => navigationRef.navigate('Chat', { conversationId });
      if (navigationRef.isReady()) go();
      else setTimeout(go, 500);
    });
  }, [status]);
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      {/* Records the app's height so screens can place the keyboard (src/hooks/useKeyboardOffset.ts) */}
      <View style={{ flex: 1 }} onLayout={(e) => recordRootHeight(e.nativeEvent.layout.height)}>
        <NavigationContainer ref={navigationRef} theme={theme}>
          <RootNavigator />
        </NavigationContainer>
      </View>
    </SafeAreaProvider>
  );
}
