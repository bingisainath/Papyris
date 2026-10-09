// src/navigation/types.ts
export type AuthStackParams = {
  Login: undefined;
  SignUp: undefined;
  VerifyEmail: { email: string; justSent?: boolean };
  ForgotPassword: undefined;
};

export type TabParams = {
  Chats: undefined;
  Expenses: undefined;
  Settings: undefined;
};

export type AppStackParams = {
  Tabs: undefined;
  Chat: { conversationId: string };
  ChatInfo: { conversationId: string; addMembers?: boolean };
  SharedMedia: { conversationId: string };
  NewChat: undefined;
  NewGroup: undefined;
  ChatExpenses: { conversationId: string };
  AddExpense: { conversationId: string; expenseId?: string };
  ScanReceipt: { conversationId: string; receiptId?: string };
  ExpenseDetail: { expenseId: string };
  Profile: undefined;
  ReceiptScanning: undefined;
  StoreDiscounts: undefined;
  Encryption: { scan?: boolean } | undefined; // scan: open the QR scanner straight away (Settings → Link a device)
  Sessions: undefined;
};
