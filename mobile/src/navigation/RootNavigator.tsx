// src/navigation/RootNavigator.tsx
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MessagesSquare, Settings, Wallet } from 'lucide-react-native';
import OfflineBanner from '../components/OfflineBanner';
import { useAuth } from '../store/auth';
import { useChat } from '../store/chat';
import { colors } from '../theme';
import type { AppStackParams, AuthStackParams, TabParams } from './types';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ChatListScreen from '../screens/chats/ChatListScreen';
import ChatScreen from '../screens/chats/ChatScreen';
import ChatInfoScreen from '../screens/chats/ChatInfoScreen';
import SharedMediaScreen from '../screens/chats/SharedMediaScreen';
import NewChatScreen from '../screens/chats/NewChatScreen';
import NewGroupScreen from '../screens/chats/NewGroupScreen';
import ExpensesHomeScreen from '../screens/expenses/ExpensesHomeScreen';
import ChatExpensesScreen from '../screens/expenses/ChatExpensesScreen';
import AddExpenseScreen from '../screens/expenses/AddExpenseScreen';
import ScanReceiptScreen from '../screens/expenses/ScanReceiptScreen';
import ExpenseDetailScreen from '../screens/expenses/ExpenseDetailScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import ProfileScreen from '../screens/settings/ProfileScreen';
import ReceiptScanningScreen from '../screens/settings/ReceiptScanningScreen';
import StoreDiscountsScreen from '../screens/settings/StoreDiscountsScreen';

const AuthStack = createNativeStackNavigator<AuthStackParams>();
const AppStack = createNativeStackNavigator<AppStackParams>();
const Tab = createBottomTabNavigator<TabParams>();

const headerStyle = {
  headerTintColor: colors.primary700,
  headerTitleStyle: { color: colors.muted900, fontWeight: '600' as const },
  headerStyle: { backgroundColor: colors.white },
  headerShadowVisible: true,
  contentStyle: { backgroundColor: colors.background },
};

const Tabs: React.FC = () => {
  const unread = useChat(s =>
    s.conversations.reduce((sum, c) => sum + (c.unreadCount > 0 ? 1 : 0), 0),
  );
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary700,
        tabBarInactiveTintColor: colors.muted500,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.muted200,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
      }}
    >
      <Tab.Screen
        name="Chats"
        component={ChatListScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MessagesSquare color={color} size={size} />
          ),
          tabBarBadge: unread ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary700 },
        }}
      />
      <Tab.Screen
        name="Expenses"
        component={ExpensesHomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Settings color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const RootNavigator: React.FC = () => {
  const status = useAuth(s => s.status);

  if (status === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary700} />
      </View>
    );
  }

  if (status === 'signedOut') {
    return (
      <AuthStack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <AuthStack.Screen name="Login" component={LoginScreen} />
        <AuthStack.Screen name="SignUp" component={SignUpScreen} />
        <AuthStack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        <AuthStack.Screen
          name="ForgotPassword"
          component={ForgotPasswordScreen}
        />
      </AuthStack.Navigator>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AppStack.Navigator screenOptions={headerStyle}>
        <AppStack.Screen
          name="Tabs"
          component={Tabs}
          options={{ headerShown: false }}
        />
        <AppStack.Screen
          name="Chat"
          component={ChatScreen}
          options={{ title: '' }}
        />
        <AppStack.Screen
          name="ChatInfo"
          component={ChatInfoScreen}
          options={{ title: 'Info' }}
        />
        <AppStack.Screen
          name="SharedMedia"
          component={SharedMediaScreen}
          options={{ title: 'Media, links and docs' }}
        />
        <AppStack.Screen
          name="NewChat"
          component={NewChatScreen}
          options={{ title: 'New chat' }}
        />
        <AppStack.Screen
          name="NewGroup"
          component={NewGroupScreen}
          options={{ title: 'New group' }}
        />
        <AppStack.Screen
          name="ChatExpenses"
          component={ChatExpensesScreen}
          options={{ title: 'Balances & expenses' }}
        />
        <AppStack.Screen
          name="AddExpense"
          component={AddExpenseScreen}
          options={{ title: 'Add expense', presentation: 'modal' }}
        />
        <AppStack.Screen
          name="ScanReceipt"
          component={ScanReceiptScreen}
          options={{ title: 'Scan receipt' }}
        />
        <AppStack.Screen
          name="ExpenseDetail"
          component={ExpenseDetailScreen}
          options={{ title: 'Expense' }}
        />
        <AppStack.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ title: 'Profile' }}
        />
        <AppStack.Screen
          name="ReceiptScanning"
          component={ReceiptScanningScreen}
          options={{ title: 'Receipt scanning' }}
        />
        <AppStack.Screen
          name="StoreDiscounts"
          component={StoreDiscountsScreen}
          options={{ title: 'Store discounts' }}
        />
      </AppStack.Navigator>
      <OfflineBanner />
    </View>
  );
};

export default RootNavigator;
