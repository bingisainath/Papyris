
// src/components/organisms/MessagesArea.tsx
import React from 'react';
import MessageBubble from '../../molecules/MessageBubble';
import Loading from '../../atoms/Loading';

interface Message {
  _id: string;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  createdAt: string;
  msgByUserId: string;
}

interface MessagesAreaProps {
  messages: Message[];
  currentUserId: string;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  loading?: boolean;
}

const MessagesArea: React.FC<MessagesAreaProps> = ({
  messages,
  currentUserId,
  messagesEndRef,
  loading
}) => {
  return (
    <section className="h-[calc(100vh-128px)] overflow-x-hidden overflow-y-scroll scrollbar bg-slate-200 bg-opacity-50">
      <div className="flex flex-col gap-2 py-4 px-4" ref={messagesEndRef}>
        {messages.length === 0 && !loading && (
          <div className="text-center text-slate-500 mt-10">
            <p>No messages yet. Start the conversation!</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg._id}
            message={msg}
            isOwn={currentUserId === msg.msgByUserId}
          />
        ))}

        {loading && (
          <div className="flex justify-center">
            <Loading />
          </div>
        )}
      </div>
    </section>
  );
};

export default MessagesArea;