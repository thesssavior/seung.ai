'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface VideoPlayerContextType {
  currentTime: number;
  seekTo: (time: number) => void;
  updateTime: (time: number) => void;
  registerAudioElement: (el: HTMLAudioElement | null) => void;
}

const VideoPlayerContext = createContext<VideoPlayerContextType | undefined>(undefined);

interface VideoPlayerProviderProps {
  children: ReactNode;
}

export function VideoPlayerProvider({ children }: VideoPlayerProviderProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const audioElementRef = React.useRef<HTMLAudioElement | null>(null);

  const registerAudioElement = useCallback((el: HTMLAudioElement | null) => {
    audioElementRef.current = el;
  }, []);

  const updateTime = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const seekTo = useCallback((time: number) => {
    setCurrentTime(time);

    // If an audio element is registered, seek it directly
    const audio = audioElementRef.current;
    if (audio) {
      audio.currentTime = Math.floor(time);
      audio.play().catch(() => {});
      return;
    }

    // Try to use YouTube iframe API first (if available)
    const iframe = document.getElementById('youtube-player') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      try {
        // Use YouTube's iframe API to seek without reloading
        iframe.contentWindow.postMessage(
          JSON.stringify({
            event: 'command',
            func: 'seekTo',
            args: [Math.floor(time), true]
          }),
          'https://www.youtube.com'
        );
        return;
      } catch (error) {
        // YouTube API not available, continue to fallback
      }
    }

    // Fallback: Create new iframe with timestamp (but try to minimize disruption)
    if (iframe) {
      const videoId = iframe.src.match(/embed\/([^?&]+)/)?.[1];
      if (videoId) {
        // Store the current iframe for smooth transition
        iframe.style.opacity = '0.7';

        // Create the new URL with timestamp
        const newSrc = `https://www.youtube.com/embed/${videoId}?start=${Math.floor(time)}&autoplay=1&enablejsapi=1`;

        // Update the src
        iframe.src = newSrc;

        // Restore opacity after a brief moment
        setTimeout(() => {
          iframe.style.opacity = '1';
        }, 500);
      }
    }
  }, []);

  return (
    <VideoPlayerContext.Provider value={{ currentTime, seekTo, updateTime, registerAudioElement }}>
      {children}
    </VideoPlayerContext.Provider>
  );
}

export function useVideoPlayer() {
  const context = useContext(VideoPlayerContext);
  if (context === undefined) {
    throw new Error('useVideoPlayer must be used within a VideoPlayerProvider');
  }
  return context;
}

export function useVideoPlayerOptional() {
  return useContext(VideoPlayerContext) ?? null;
} 