'use client';

import { useEffect, useRef } from 'react';
import { useVideoPlayerOptional } from '@/contexts/VideoPlayerContext';

interface VideoPlayerProps {
  videoId: string | null;
  title?: string;
}

export function VideoPlayer({ videoId, title }: VideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoPlayer = useVideoPlayerOptional();
  const updateTimeRef = useRef(videoPlayer?.updateTime);
  updateTimeRef.current = videoPlayer?.updateTime;

  // Listen for YouTube's infoDelivery postMessages to track current time
  useEffect(() => {
    if (!videoId) return;

    const iframe = iframeRef.current;
    if (!iframe) return;

    const sendListening = () => {
      try {
        iframe.contentWindow?.postMessage(
          JSON.stringify({ event: 'listening' }),
          'https://www.youtube.com'
        );
      } catch {}
    };

    let lastUpdate = 0;
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.youtube.com') return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.event === 'infoDelivery' && data.info?.currentTime !== undefined) {
          // Throttle updates to ~1 per second
          const now = Date.now();
          if (now - lastUpdate >= 1000) {
            lastUpdate = now;
            updateTimeRef.current?.(data.info.currentTime);
          }
        }
      } catch {}
    };

    window.addEventListener('message', handleMessage);
    iframe.addEventListener('load', sendListening);
    // Try immediately in case iframe is already loaded
    sendListening();

    return () => {
      window.removeEventListener('message', handleMessage);
      iframe.removeEventListener('load', sendListening);
    };
  }, [videoId]);

  return (
    <div className="h-full bg-black overflow-hidden rounded-lg flex items-center justify-center">
      {videoId ? (
        <div className="w-full h-full flex items-center justify-center">
          <iframe
            ref={iframeRef}
            id="youtube-player"
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
            title={title || "YouTube video player"}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full rounded-lg object-contain"
            style={{ aspectRatio: '16/9', maxHeight: '100%', maxWidth: '100%' }}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-white">
          <p>No video available</p>
        </div>
      )}
    </div>
  );
}
