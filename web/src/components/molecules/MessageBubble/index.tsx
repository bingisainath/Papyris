
// src/components/molecules/MessageBubble.tsx
import React from 'react';
import moment from 'moment';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';

interface MessageBubbleProps {
  message: {
    text?: string;
    imageUrl?: string;
    videoUrl?: string;
    createdAt: string;
    msgByUserId: string;
  };
  isOwn: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn }) => {
  return (
    <div
      className={`p-2 rounded-lg w-fit max-w-[280px] md:max-w-sm lg:max-w-md ${
        isOwn ? 'ml-auto bg-teal-100' : 'bg-white'
      }`}
    >
      <div className="w-full relative">
        {message?.imageUrl && (
          <LazyLoadImage
            src={message.imageUrl}
            alt="Message Image"
            effect="blur"
            className="w-full h-full object-scale-down rounded"
          />
        )}
        {message?.videoUrl && (
          <video
            src={message.videoUrl}
            className="w-full h-full object-scale-down rounded"
            controls
          />
        )}
      </div>
      {message.text && <p className="px-2 py-1">{message.text}</p>}
      <p className="text-xs text-slate-500 text-right px-2">
        {moment(message.createdAt).format('hh:mm A')}
      </p>
    </div>
  );
};

export default MessageBubble;
