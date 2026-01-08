
// src/components/molecules/MessageInput.tsx
import React, { useState, useCallback } from 'react';
import { FaPlus, FaImage, FaVideo } from 'react-icons/fa6';
import { IoMdSend } from 'react-icons/io';
import Button from '../../atoms/Button';

interface MessageInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onVideoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({
  value,
  onChange,
  onSubmit,
  onImageUpload,
  onVideoUpload,
  disabled = false
}) => {
  const [showUploadMenu, setShowUploadMenu] = useState(false);

  const handleToggleMenu = useCallback(() => {
    setShowUploadMenu(prev => !prev);
  }, []);

  return (
    <section className="h-16 bg-white flex items-center px-4 border-t">
      <div className="relative">
        <Button
          variant="icon"
          onClick={handleToggleMenu}
          icon={<FaPlus size={20} />}
        />

        {showUploadMenu && (
          <div className="bg-white shadow-lg rounded-lg absolute bottom-14 w-36 p-2 border">
            <label
              htmlFor="uploadImage"
              className="flex items-center p-2 px-3 gap-3 hover:bg-slate-100 cursor-pointer rounded"
            >
              <FaImage className="text-primary" size={18} />
              <span>Image</span>
            </label>
            <label
              htmlFor="uploadVideo"
              className="flex items-center p-2 px-3 gap-3 hover:bg-slate-100 cursor-pointer rounded"
            >
              <FaVideo className="text-purple-500" size={18} />
              <span>Video</span>
            </label>

            <input
              type="file"
              id="uploadImage"
              accept="image/*"
              onChange={(e) => {
                onImageUpload(e);
                setShowUploadMenu(false);
              }}
              className="hidden"
            />
            <input
              type="file"
              id="uploadVideo"
              accept="video/*"
              onChange={(e) => {
                onVideoUpload(e);
                setShowUploadMenu(false);
              }}
              className="hidden"
            />
          </div>
        )}
      </div>

      <form className="h-full w-full flex gap-2" onSubmit={onSubmit}>
        <input
          type="text"
          placeholder="Type a message..."
          className="py-2 px-4 outline-none w-full h-full rounded-lg focus:ring-2 focus:ring-primary"
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
        <Button
          type="submit"
          variant="ghost"
          disabled={disabled || !value.trim()}
          className="text-primary hover:text-secondary"
          icon={<IoMdSend size={28} />}
        />
      </form>
    </section>
  );
};

export default MessageInput;
