// src/data/dummyData.ts - COMPREHENSIVE DUMMY DATA FOR TESTING

export const dummyUsers = [
  {
    id: 'user1',
    name: 'Alice Johnson',
    username: 'alice_j',
    email: 'alice@example.com',
    avatar: undefined,
    bio: 'Coffee lover ☕ | Travel enthusiast 🌍',
    isOnline: true,
    lastSeen: undefined,
  },
  {
    id: 'user2',
    name: 'Bob Smith',
    username: 'bob_smith',
    email: 'bob@example.com',
    avatar: undefined,
    bio: 'Tech geek 💻 | Gamer 🎮',
    isOnline: true,
    lastSeen: undefined,
  },
  {
    id: 'user3',
    name: 'Charlie Davis',
    username: 'charlie_d',
    email: 'charlie@example.com',
    avatar: undefined,
    bio: 'Foodie 🍕 | Photographer 📸',
    isOnline: false,
    lastSeen: '2 hours ago',
  },
  {
    id: 'user4',
    name: 'Diana Wilson',
    username: 'diana_w',
    email: 'diana@example.com',
    avatar: undefined,
    bio: 'Yoga instructor 🧘 | Nature lover 🌿',
    isOnline: true,
    lastSeen: undefined,
  },
  {
    id: 'user5',
    name: 'Ethan Brown',
    username: 'ethan_b',
    email: 'ethan@example.com',
    avatar: undefined,
    bio: 'Music producer 🎵 | DJ',
    isOnline: false,
    lastSeen: 'Yesterday',
  },
  {
    id: 'user6',
    name: 'Fiona Taylor',
    username: 'fiona_t',
    email: 'fiona@example.com',
    avatar: undefined,
    bio: 'Artist 🎨 | Designer',
    isOnline: true,
    lastSeen: undefined,
  },
  {
    id: 'current-user',
    name: 'John Doe',
    username: 'john_doe',
    email: 'john@example.com',
    avatar: undefined,
    bio: 'Software Engineer 👨‍💻 | Coffee addict',
    isOnline: true,
    lastSeen: undefined,
  }
];

export const dummyConversations = [
  // Pinned direct chat
  {
    id: 'conv1',
    name: 'Alice Johnson',
    avatar: undefined,
    lastMessage: 'See you at the coffee shop! ☕',
    lastMessageTime: '10:30 AM',
    unreadCount: 3,
    isOnline: true,
    isTyping: false,
    isPinned: true,
    isGroup: false,
    members: ['current-user', 'user1']
  },
  // Active group chat
  {
    id: 'conv2',
    name: 'Weekend Trip Planning',
    avatar: undefined,
    lastMessage: 'Bob: Who is bringing the drinks?',
    lastMessageTime: '9:45 AM',
    unreadCount: 12,
    isOnline: false,
    isTyping: true,
    isPinned: true,
    isGroup: true,
    members: ['current-user', 'user2', 'user3', 'user4']
  },
  // Recent direct chat
  {
    id: 'conv3',
    name: 'Charlie Davis',
    avatar: undefined,
    lastMessage: 'Thanks for the recommendation! 🙏',
    lastMessageTime: 'Yesterday',
    unreadCount: 0,
    isOnline: false,
    isTyping: false,
    isPinned: false,
    isGroup: false,
    members: ['current-user', 'user3']
  },
  // Work group
  {
    id: 'conv4',
    name: 'Team Standup',
    avatar: undefined,
    lastMessage: 'Diana: Meeting at 2 PM today',
    lastMessageTime: 'Yesterday',
    unreadCount: 5,
    isOnline: false,
    isTyping: false,
    isPinned: false,
    isGroup: true,
    members: ['current-user', 'user4', 'user5', 'user6']
  },
  // Direct chat with typing
  {
    id: 'conv5',
    name: 'Bob Smith',
    avatar: undefined,
    lastMessage: 'Did you finish the report?',
    lastMessageTime: '2 days ago',
    unreadCount: 0,
    isOnline: true,
    isTyping: true,
    isPinned: false,
    isGroup: false,
    members: ['current-user', 'user2']
  },
  // Hobby group
  {
    id: 'conv6',
    name: 'Photography Club',
    avatar: undefined,
    lastMessage: 'Fiona: Check out my latest shots!',
    lastMessageTime: '3 days ago',
    unreadCount: 2,
    isOnline: false,
    isTyping: false,
    isPinned: false,
    isGroup: true,
    members: ['current-user', 'user3', 'user6']
  },
  // Old direct chat
  {
    id: 'conv7',
    name: 'Ethan Brown',
    avatar: undefined,
    lastMessage: 'Sure, sounds good!',
    lastMessageTime: '1 week ago',
    unreadCount: 0,
    isOnline: false,
    isTyping: false,
    isPinned: false,
    isGroup: false,
    members: ['current-user', 'user5']
  },
  // Fitness group
  {
    id: 'conv8',
    name: 'Morning Yoga Sessions',
    avatar: undefined,
    lastMessage: 'Diana: Tomorrow at 7 AM?',
    lastMessageTime: '1 week ago',
    unreadCount: 1,
    isOnline: false,
    isTyping: false,
    isPinned: false,
    isGroup: true,
    members: ['current-user', 'user4', 'user1']
  },
  // Another direct chat
  {
    id: 'conv9',
    name: 'Fiona Taylor',
    avatar: undefined,
    lastMessage: 'Love the new design! 🎨',
    lastMessageTime: '2 weeks ago',
    unreadCount: 0,
    isOnline: true,
    isTyping: false,
    isPinned: false,
    isGroup: false,
    members: ['current-user', 'user6']
  }
];

export const dummyMessages = {
  // Messages for Alice Johnson chat
  conv1: [
    {
      id: 'msg1',
      text: 'Hey! How are you doing?',
      timestamp: '10:15 AM',
      senderId: 'user1',
      senderName: 'Alice Johnson',
      senderAvatar: undefined,
      status: 'read' as const,
    },
    {
      id: 'msg2',
      text: "I'm good! Just finished a great workout 💪",
      timestamp: '10:16 AM',
      senderId: 'current-user',
      status: 'read' as const,
    },
    {
      id: 'msg3',
      text: 'Nice! Want to grab coffee later?',
      timestamp: '10:20 AM',
      senderId: 'user1',
      senderName: 'Alice Johnson',
      senderAvatar: undefined,
      status: 'read' as const,
    },
    {
      id: 'msg4',
      text: 'Absolutely! What time works for you?',
      timestamp: '10:25 AM',
      senderId: 'current-user',
      status: 'read' as const,
    },
    {
      id: 'msg5',
      text: 'How about 3 PM at our usual spot?',
      timestamp: '10:28 AM',
      senderId: 'user1',
      senderName: 'Alice Johnson',
      senderAvatar: undefined,
      status: 'read' as const,
    },
    {
      id: 'msg6',
      text: 'Perfect! See you then!',
      timestamp: '10:29 AM',
      senderId: 'current-user',
      status: 'delivered' as const,
    },
    {
      id: 'msg7',
      text: 'See you at the coffee shop! ☕',
      timestamp: '10:30 AM',
      senderId: 'user1',
      senderName: 'Alice Johnson',
      senderAvatar: undefined,
      status: 'delivered' as const,
    }
  ],

  // Messages for Weekend Trip group
  conv2: [
    {
      id: 'msg10',
      text: 'Hey everyone! So excited for this trip! 🎉',
      timestamp: '9:00 AM',
      senderId: 'user2',
      senderName: 'Bob Smith',
      senderAvatar: undefined,
      senderColor: '#3b82f6',
      status: 'read' as const,
    },
    {
      id: 'msg11',
      text: 'Me too! Has anyone booked the accommodation yet?',
      timestamp: '9:15 AM',
      senderId: 'user3',
      senderName: 'Charlie Davis',
      senderAvatar: undefined,
      senderColor: '#10b981',
      status: 'read' as const,
    },
    {
      id: 'msg12',
      text: "I can handle that! I'll book it today.",
      timestamp: '9:20 AM',
      senderId: 'current-user',
      status: 'read' as const,
    },
    {
      id: 'msg13',
      text: 'Great! I can organize the transportation 🚗',
      timestamp: '9:30 AM',
      senderId: 'user4',
      senderName: 'Diana Wilson',
      senderAvatar: undefined,
      senderColor: '#f59e0b',
      status: 'read' as const,
    },
    {
      id: 'msg14',
      text: 'Perfect! What about food and drinks?',
      timestamp: '9:40 AM',
      senderId: 'user3',
      senderName: 'Charlie Davis',
      senderAvatar: undefined,
      senderColor: '#10b981',
      status: 'read' as const,
    },
    {
      id: 'msg15',
      text: 'Who is bringing the drinks?',
      timestamp: '9:45 AM',
      senderId: 'user2',
      senderName: 'Bob Smith',
      senderAvatar: undefined,
      senderColor: '#3b82f6',
      status: 'delivered' as const,
    }
  ],

  // Messages for Bob Smith chat
  conv5: [
    {
      id: 'msg20',
      text: 'Hey, did you get a chance to review the document?',
      timestamp: '2 days ago',
      senderId: 'user2',
      senderName: 'Bob Smith',
      senderAvatar: undefined,
      status: 'read' as const,
    },
    {
      id: 'msg21',
      text: 'Yes! I made some comments. Check it out.',
      timestamp: '2 days ago',
      senderId: 'current-user',
      status: 'read' as const,
    },
    {
      id: 'msg22',
      text: 'Perfect! Did you finish the report?',
      timestamp: '2 days ago',
      senderId: 'user2',
      senderName: 'Bob Smith',
      senderAvatar: undefined,
      status: 'read' as const,
    }
  ]
};

export const dummyExpenses = [
  {
    id: 'exp1',
    description: 'Weekend Trip Accommodation',
    totalAmount: 480.00,
    paidBy: {
      id: 'current-user',
      name: 'John Doe',
      avatar: undefined
    },
    category: 'accommodation',
    date: 'Today',
    status: 'pending' as const,
    splitType: 'equal' as const,
    shares: [
      {
        userId: 'current-user',
        userName: 'John Doe',
        userAvatar: undefined,
        amount: 120.00,
        paid: true
      },
      {
        userId: 'user2',
        userName: 'Bob Smith',
        userAvatar: undefined,
        amount: 120.00,
        paid: false
      },
      {
        userId: 'user3',
        userName: 'Charlie Davis',
        userAvatar: undefined,
        amount: 120.00,
        paid: false
      },
      {
        userId: 'user4',
        userName: 'Diana Wilson',
        userAvatar: undefined,
        amount: 120.00,
        paid: false
      }
    ]
  },
  {
    id: 'exp2',
    description: 'Team Lunch',
    totalAmount: 156.00,
    paidBy: {
      id: 'user4',
      name: 'Diana Wilson',
      avatar: undefined
    },
    category: 'food',
    date: 'Yesterday',
    status: 'pending' as const,
    splitType: 'equal' as const,
    shares: [
      {
        userId: 'current-user',
        userName: 'John Doe',
        userAvatar: undefined,
        amount: 26.00,
        paid: false
      },
      {
        userId: 'user4',
        userName: 'Diana Wilson',
        userAvatar: undefined,
        amount: 26.00,
        paid: true
      },
      {
        userId: 'user5',
        userName: 'Ethan Brown',
        userAvatar: undefined,
        amount: 26.00,
        paid: false
      },
      {
        userId: 'user6',
        userName: 'Fiona Taylor',
        userAvatar: undefined,
        amount: 26.00,
        paid: true
      },
      {
        userId: 'user1',
        userName: 'Alice Johnson',
        userAvatar: undefined,
        amount: 26.00,
        paid: false
      },
      {
        userId: 'user2',
        userName: 'Bob Smith',
        userAvatar: undefined,
        amount: 26.00,
        paid: false
      }
    ]
  },
  {
    id: 'exp3',
    description: 'Uber to Airport',
    totalAmount: 45.50,
    paidBy: {
      id: 'user3',
      name: 'Charlie Davis',
      avatar: undefined
    },
    category: 'transport',
    date: '2 days ago',
    status: 'partial' as const,
    splitType: 'equal' as const,
    shares: [
      {
        userId: 'current-user',
        userName: 'John Doe',
        userAvatar: undefined,
        amount: 15.17,
        paid: true
      },
      {
        userId: 'user3',
        userName: 'Charlie Davis',
        userAvatar: undefined,
        amount: 15.17,
        paid: true
      },
      {
        userId: 'user1',
        userName: 'Alice Johnson',
        userAvatar: undefined,
        amount: 15.16,
        paid: false
      }
    ]
  },
  {
    id: 'exp4',
    description: 'Movie Tickets',
    totalAmount: 72.00,
    paidBy: {
      id: 'user1',
      name: 'Alice Johnson',
      avatar: undefined
    },
    category: 'entertainment',
    date: '3 days ago',
    status: 'pending' as const,
    splitType: 'equal' as const,
    shares: [
      {
        userId: 'current-user',
        userName: 'John Doe',
        userAvatar: undefined,
        amount: 24.00,
        paid: false
      },
      {
        userId: 'user1',
        userName: 'Alice Johnson',
        userAvatar: undefined,
        amount: 24.00,
        paid: true
      },
      {
        userId: 'user6',
        userName: 'Fiona Taylor',
        userAvatar: undefined,
        amount: 24.00,
        paid: false
      }
    ]
  },
  {
    id: 'exp5',
    description: 'Grocery Shopping',
    totalAmount: 124.80,
    paidBy: {
      id: 'current-user',
      name: 'John Doe',
      avatar: undefined
    },
    category: 'shopping',
    date: '1 week ago',
    status: 'settled' as const,
    splitType: 'equal' as const,
    shares: [
      {
        userId: 'current-user',
        userName: 'John Doe',
        userAvatar: undefined,
        amount: 62.40,
        paid: true
      },
      {
        userId: 'user2',
        userName: 'Bob Smith',
        userAvatar: undefined,
        amount: 62.40,
        paid: true
      }
    ]
  },
  {
    id: 'exp6',
    description: 'Internet Bill',
    totalAmount: 89.99,
    paidBy: {
      id: 'user2',
      name: 'Bob Smith',
      avatar: undefined
    },
    category: 'utilities',
    date: '2 weeks ago',
    status: 'settled' as const,
    splitType: 'equal' as const,
    shares: [
      {
        userId: 'current-user',
        userName: 'John Doe',
        userAvatar: undefined,
        amount: 44.995,
        paid: true
      },
      {
        userId: 'user2',
        userName: 'Bob Smith',
        userAvatar: undefined,
        amount: 44.995,
        paid: true
      }
    ]
  },
  {
    id: 'exp7',
    description: 'Birthday Dinner',
    totalAmount: 245.00,
    paidBy: {
      id: 'user5',
      name: 'Ethan Brown',
      avatar: undefined
    },
    category: 'food',
    date: '2 weeks ago',
    status: 'pending' as const,
    splitType: 'equal' as const,
    shares: [
      {
        userId: 'current-user',
        userName: 'John Doe',
        userAvatar: undefined,
        amount: 49.00,
        paid: false
      },
      {
        userId: 'user5',
        userName: 'Ethan Brown',
        userAvatar: undefined,
        amount: 49.00,
        paid: true
      },
      {
        userId: 'user1',
        userName: 'Alice Johnson',
        userAvatar: undefined,
        amount: 49.00,
        paid: true
      },
      {
        userId: 'user3',
        userName: 'Charlie Davis',
        userAvatar: undefined,
        amount: 49.00,
        paid: false
      },
      {
        userId: 'user6',
        userName: 'Fiona Taylor',
        userAvatar: undefined,
        amount: 49.00,
        paid: true
      }
    ]
  }
];

// Calculate expense totals for current user
export const calculateExpenseTotals = (expenses: typeof dummyExpenses, currentUserId: string) => {
  let totalOwed = 0;
  let totalOwe = 0;
  let totalSettled = 0;

  expenses.forEach(expense => {
    if (expense.status === 'settled') {
      totalSettled += expense.totalAmount;
    } else {
      const userShare = expense.shares.find(s => s.userId === currentUserId);
      
      if (expense.paidBy.id === currentUserId) {
        // User paid, others owe them
        const unpaidShares = expense.shares.filter(s => s.userId !== currentUserId && !s.paid);
        totalOwed += unpaidShares.reduce((sum, s) => sum + s.amount, 0);
      } else if (userShare && !userShare.paid) {
        // User owes money
        totalOwe += userShare.amount;
      }
    }
  });

  return { totalOwed, totalOwe, totalSettled };
};

export const currentUser = dummyUsers.find(u => u.id === 'current-user')!;