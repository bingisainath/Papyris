// src/components/organisms/ChatWindow.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import ChatHeader from '../ChatHeader';
import MessagesArea from '../MessagesArea';
import MessageInput from '../../molecules/MessageInput';
import UploadPreview from '../../molecules/UploadPreview';
import Loading from '../Loading';
import uploadFile from '../../helper/uploadFile';
import backgroundImage from '../../assets/wallpaper.jpeg';

const ChatWindow: React.FC = () => {
  const params = useParams<{ userId: string }>();
  const socketConnection = useSelector((state: any) => state?.user?.socketConnection);
  const user = useSelector((state: any) => state?.user);

  const [dataUser, setDataUser] = useState({
    name: '',
    email: '',
    profile_pic: '',
    online: false,
    _id: ''
  });
  
  const [message, setMessage] = useState({
    text: '',
    imageUrl: '',
    videoUrl: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [allMessage, setAllMessage] = useState([]);
  const currentMessage = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (currentMessage.current) {
      currentMessage.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [allMessage]);

  // Socket listeners
  useEffect(() => {
    if (socketConnection) {
      socketConnection.emit('message-page', params.userId);
      socketConnection.emit('seen', params.userId);

      socketConnection.on('message-user', (data: any) => {
        setDataUser(data);
      });

      socketConnection.on('user-message', (data: any) => {
        setAllMessage(data);
      });
    }
  }, [socketConnection, params?.userId]);

  // Handle image upload
  const handleUploadImage = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const uploadPhoto = await uploadFile(file);
      setMessage(prev => ({ ...prev, imageUrl: uploadPhoto.url }));
    } catch (error) {
      console.error('Image upload failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle video upload
  const handleUploadVideo = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const uploadPhoto = await uploadFile(file);
      setMessage(prev => ({ ...prev, videoUrl: uploadPhoto.url }));
    } catch (error) {
      console.error('Video upload failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Clear uploads
  const handleClearImage = useCallback(() => {
    setMessage(prev => ({ ...prev, imageUrl: '' }));
  }, []);

  const handleClearVideo = useCallback(() => {
    setMessage(prev => ({ ...prev, videoUrl: '' }));
  }, []);

  // Handle text input
  const handleOnChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(prev => ({ ...prev, text: e.target.value }));
  }, []);

  // Send message
  const handleSendMessage = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (message.text || message.imageUrl || message.videoUrl) {
      if (socketConnection) {
        socketConnection.emit('new message', {
          sender: user?._id,
          receiver: params.userId,
          text: message.text,
          imageUrl: message.imageUrl,
          videoUrl: message.videoUrl,
          msgByUserId: user?._id
        });
        
        setMessage({ text: '', imageUrl: '', videoUrl: '' });
      }
    }
  }, [message, socketConnection, params.userId, user?._id]);

  return (
    <div
      style={{ backgroundImage: `url(${backgroundImage})` }}
      className="bg-no-repeat bg-cover h-full"
    >
      <ChatHeader
        name={dataUser.name}
        profilePic={dataUser.profile_pic}
        userId={dataUser._id}
        isOnline={dataUser.online}
      />

      <MessagesArea
        messages={allMessage}
        currentUserId={user._id}
        messagesEndRef={currentMessage}
        loading={loading}
      />

      {/* Upload Previews */}
      <UploadPreview
        imageUrl={message.imageUrl}
        videoUrl={message.videoUrl}
        onClear={message.imageUrl ? handleClearImage : handleClearVideo}
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50">
          <Loading />
        </div>
      )}

      <MessageInput
        value={message.text}
        onChange={handleOnChange}
        onSubmit={handleSendMessage}
        onImageUpload={handleUploadImage}
        onVideoUpload={handleUploadVideo}
        disabled={loading}
      />
    </div>
  );
};

export default ChatWindow;