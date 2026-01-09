
// src/components/molecules/UploadPreview.tsx
import React from 'react';
import { IoClose } from 'react-icons/io5';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import Button from '../../atoms/Button';

interface UploadPreviewProps {
  imageUrl?: string;
  videoUrl?: string;
  onClear: () => void;
}

const UploadPreview: React.FC<UploadPreviewProps> = ({ imageUrl, videoUrl, onClear }) => {
  if (!imageUrl && !videoUrl) return null;

  return (
    <div className="w-full h-full sticky bottom-0 bg-slate-700 bg-opacity-50 flex justify-center items-center rounded overflow-hidden">
      <Button
        variant="ghost"
        className="absolute top-2 right-2 text-white hover:text-red-500"
        onClick={onClear}
        icon={<IoClose size={30} />}
      />
      <div className="bg-white p-4 rounded-lg">
        {imageUrl && (
          <LazyLoadImage
            src={imageUrl}
            alt="Upload Preview"
            effect="blur"
            className="max-w-sm max-h-96 object-contain"
          />
        )}
        {videoUrl && (
          <video
            src={videoUrl}
            className="max-w-sm max-h-96 object-contain"
            controls
            muted
            autoPlay
          />
        )}
      </div>
    </div>
  );
};

export default UploadPreview;