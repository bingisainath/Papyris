// src/components/molecules/VoiceNotePlayer.tsx
// Voice message bubble content: play/pause, a seekable progress bar, time, and playback speed.

import React, { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play } from 'lucide-react';
import { formatDuration } from '../../utils/media';

const SPEEDS = [1, 1.5, 2];

interface Props {
  src?: string;
  duration?: number; // seconds, from the sender (recorded webm files often don't know their length)
  isSent: boolean;
  onError?: () => void;
}

const VoiceNotePlayer: React.FC<Props> = ({ src, duration, isSent, onError }) => {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [length, setLength] = useState(duration || 0);
  const [speed, setSpeed] = useState(1);
  const probing = useRef(false);

  useEffect(() => { if (audio.current) audio.current.playbackRate = speed; }, [speed]);

  const toggle = () => {
    const el = audio.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => onError?.());
    else el.pause();
  };

  const tone = isSent ? 'text-white' : 'text-primary-700';

  return (
    <div className="flex items-center gap-3 w-60 max-w-full py-1">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isSent ? 'bg-white/20 hover:bg-white/30' : 'bg-primary-50 hover:bg-primary-100'} ${tone}`}
      >
        {playing ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5 ml-0.5" fill="currentColor" />}
      </button>
      <div className="flex-1 min-w-0">
        <input
          type="range"
          min={0}
          max={length || 1}
          step={0.1}
          value={current}
          aria-label="Position in voice message"
          onChange={(e) => {
            const value = Number(e.target.value);
            if (audio.current) audio.current.currentTime = value;
            setCurrent(value);
          }}
          className={`w-full h-1 cursor-pointer ${isSent ? 'accent-white' : 'accent-primary-700'}`}
        />
        <div className={`flex items-center justify-between mt-1 text-[11px] ${isSent ? 'text-white/80' : 'text-muted-500'}`}>
          <span className="inline-flex items-center gap-1">
            <Mic className="w-3 h-3" /> {formatDuration(playing || current ? current : length)}
          </span>
          <button
            type="button"
            onClick={() => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])}
            className={`px-1.5 rounded font-semibold ${isSent ? 'bg-white/20' : 'bg-muted-100'}`}
            aria-label="Playback speed"
          >
            {speed}×
          </button>
        </div>
      </div>
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrent(0); }}
        onTimeUpdate={(e) => { if (!probing.current) setCurrent(e.currentTarget.currentTime); }}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          if (Number.isFinite(el.duration) && el.duration > 0) {
            setLength(el.duration);
          } else if (!duration) {
            // Recorded webm files often don't store their length: seek to the end to make the browser work it out
            probing.current = true;
            el.currentTime = 1e7;
          }
        }}
        onDurationChange={(e) => {
          const el = e.currentTarget;
          if (probing.current && Number.isFinite(el.duration) && el.duration > 0) {
            probing.current = false;
            setLength(el.duration);
            el.currentTime = 0;
          }
        }}
        onError={onError}
      />
    </div>
  );
};

export default VoiceNotePlayer;
