// // src/api/chat.api.ts
// import axios from '../utils/axios';

// export const createDirectConversation = async (userId: string) => {
//   const res = await axios.post('/conversations', {
//     kind: 'dm',
//     participant_ids: [userId],
//   });

//   return res.data.data; // { id }
// };


// src/api/chat.api.ts
import api from "../utils/axios";

export const createDirectConversation = async (otherUserId: string) => {
  const res = await api.post('/api/v1/conversations', {
    kind: 'dm',
    participant_ids: [otherUserId],
  });

  return res.data.data; // { id: conversationId }
};
