"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { YoutubeIcon, AlertCircle, X, Loader2, FileText, Upload, Mic, Square, Headphones, ArrowUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from 'next-intl';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from "@/contexts/AuthContext";
import { useFolder } from '../home/SidebarLayout';
import { useSummaryGeneration } from '@/contexts/SummaryGenerationContext';
import { useHydration } from '@/hooks/useHydration';
import { extractVideoId } from '@/lib/utils';
import * as pdfjsLib from 'pdfjs-dist';
import posthog from 'posthog-js';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface FolderType {
  id: string;
  name: string;
}

type InputMode = 'youtube' | 'pdf' | 'audio';

/**
 * Trickle progress — smoothly advances toward a cap, slowing as it approaches.
 * Call `start(label, cap)` to begin trickling toward `cap` (e.g. 90%).
 * Call `jump(value, label)` to instantly set a new floor + optionally change label.
 * Call `finish()` to snap to 100% then reset after a beat.
 * Call `reset()` to clear immediately.
 */
function useTrickleProgress() {
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const capRef = useRef(90);

  const clearTrickle = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTrickle = useCallback((cap: number) => {
    clearTrickle();
    capRef.current = cap;
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= capRef.current) return prev;
        // Slow down as we approach cap: increment shrinks proportionally
        const remaining = capRef.current - prev;
        const increment = Math.max(0.3, remaining * 0.04);
        return Math.min(prev + increment, capRef.current);
      });
    }, 200);
  }, [clearTrickle]);

  const start = useCallback((newLabel: string, cap = 90) => {
    setProgress(2);
    setLabel(newLabel);
    startTrickle(cap);
  }, [startTrickle]);

  const jump = useCallback((value: number, newLabel?: string, newCap = 90) => {
    clearTrickle();
    setProgress(value);
    if (newLabel !== undefined) setLabel(newLabel);
    capRef.current = newCap;
    startTrickle(newCap);
  }, [clearTrickle, startTrickle]);

  const finish = useCallback(() => {
    clearTrickle();
    setProgress(100);
  }, [clearTrickle]);

  const reset = useCallback(() => {
    clearTrickle();
    setProgress(0);
    setLabel('');
  }, [clearTrickle]);

  // Cleanup on unmount
  useEffect(() => clearTrickle, [clearTrickle]);

  return { progress: Math.round(progress), label, start, jump, finish, reset };
}

function LoadingProgressBar({ progress, label }: { progress: number; label: string }) {
  return (
    <div className="w-full max-w-xs mx-auto space-y-2">
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-foreground rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
      <div className="flex items-center justify-center gap-2">
        <motion.span
          className="text-sm text-muted-foreground"
          key={label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {label}
        </motion.span>
        <span className="text-sm text-muted-foreground tabular-nums">{progress}%</span>
      </div>
    </div>
  );
}

export function VideoInputForm() {
  const t = useTranslations();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = params.locale as string;
  const { activeFolder, openSubscriptionModal } = useFolder();
  const { setGenerationData } = useSummaryGeneration();
  const isHydrated = useHydration();

  const [inputMode, setInputMode] = useState<InputMode>('youtube');
  const [url, setUrl] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const trickle = useTrickleProgress();
  const [error, setError] = useState("");
  const { user, signInWithGoogle } = useAuth();
  const [userPlan, setUserPlan] = useState<string>('free');
  const [planLoaded, setPlanLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch user plan
  useEffect(() => {
    const fetchPlan = async () => {
      if (user) {
        try {
          const res = await fetch('/api/home/user/plan');
          if (!res.ok) { setUserPlan('free'); setPlanLoaded(true); return; }
          const data = await res.json();
          setUserPlan(data.plan || 'free');
        } catch {
          setUserPlan('free');
        }
      }
      setPlanLoaded(true);
    };
    fetchPlan();
  }, [user]);

  // Clear trial-related states when plan is confirmed as premium
  useEffect(() => {
    if (userPlan === 'premium') {
      setTrialLimitExceeded(false);
      setShowTokenLimitUpgrade(false);
    }
  }, [userPlan]);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [trialUsed, setTrialUsed] = useState(false);
  const [inAppBrowser, setInAppBrowser] = useState(false);
  const [showTokenLimitUpgrade, setShowTokenLimitUpgrade] = useState(false);
  const [trialLimitExceeded, setTrialLimitExceeded] = useState(false);
  const [freeTrialsRemaining, setFreeTrialsRemaining] = useState(3);

  // Check localStorage for trial status on mount - only after hydration
  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      const storedTrialUsed = localStorage.getItem('trialUsed');
      if (storedTrialUsed === 'true') {
        setTrialUsed(true);
      }
      // Check free trials count for signed-in free users
      const storedTrialCount = localStorage.getItem('freeUserTrialCount');
      const count = storedTrialCount ? parseInt(storedTrialCount, 10) : 0;
      setFreeTrialsRemaining(3 - count);
    }
  }, [isHydrated]);

  // Extract video ID from URL passed as query param
  useEffect(() => {
    const youtubeParam = searchParams.get('youtube');
    if (youtubeParam) {
      try {
        setUrl(decodeURIComponent(youtubeParam));
      } catch {
        setUrl(youtubeParam); // fallback if decoding fails
      }
    }
  }, [searchParams]);

  // Check if the user is using an in-app browser - only after hydration
  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      const ua = navigator.userAgent || navigator.vendor;
      if (/KAKAOTALK/i.test(ua)) {
        setInAppBrowser(true);
      } else {
        setInAppBrowser(false);
      }
    }
  }, [isHydrated]);

  const extractPdfText = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const textParts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      if (pageText.trim()) {
        textParts.push(pageText);
      }
    }

    return textParts.join('\n\n');
  };

  const checkTrialAndPlan = useCallback((): boolean => {
    if (!user && trialUsed) {
      setShowLoginPrompt(true);
      return false;
    }

    if (user && planLoaded && userPlan !== 'premium' && isHydrated && typeof window !== 'undefined') {
      const storedTrialCount = localStorage.getItem('freeUserTrialCount');
      const count = storedTrialCount ? parseInt(storedTrialCount, 10) : 0;

      if (count >= 3) {
        setTrialLimitExceeded(true);
        setError(t('trialLimitExceededError'));
        setIsLoading(false);
        openSubscriptionModal();
        return false;
      }
    }

    return true;
  }, [user, trialUsed, planLoaded, userPlan, isHydrated, t, openSubscriptionModal]);

  const markTrialUsed = useCallback(() => {
    if (!user && isHydrated) {
      setTrialUsed(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('trialUsed', 'true');
      }
    } else if (user && userPlan !== 'premium' && isHydrated) {
      if (typeof window !== 'undefined') {
        const storedTrialCount = localStorage.getItem('freeUserTrialCount');
        const count = storedTrialCount ? parseInt(storedTrialCount, 10) : 0;
        const newCount = count + 1;
        localStorage.setItem('freeUserTrialCount', newCount.toString());
        setFreeTrialsRemaining(3 - newCount);
      }
    }
  }, [user, userPlan, isHydrated]);

  const navigateToSummary = useCallback((fileId: string | null, transcriptData: any) => {
    setGenerationData({
      transcriptData,
      folderForSummary: activeFolder ? { id: activeFolder.id, name: activeFolder.name } : null,
    });

    if (fileId) {
      router.push(`/${locale}/files/${fileId}`);
    } else {
      router.push(`/${locale}/files/preview`);
    }
  }, [activeFolder, locale, router, setGenerationData]);

  const submitVideo = useCallback(async () => {
    setError("");
    setShowTokenLimitUpgrade(false);
    setTrialLimitExceeded(false);

    if (!checkTrialAndPlan()) return;

    setIsLoading(true);
    trickle.start(t('fetchingTranscript'), 90);

    try {
      const videoId = extractVideoId(url);
      if (!videoId) {
        throw new Error(t('error') + ": " + t('invalidUrl'));
      }

      const contentLanguage = typeof window !== 'undefined'
        ? localStorage.getItem('contentLanguage') || locale
        : locale;

      const transcriptResponse = await fetch('/api/files/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          locale,
          contentLanguage,
          folderId: activeFolder?.id || null,
        }),
      });

      if (!transcriptResponse.ok) {
        const errorData = await transcriptResponse.json();
        const errorMessage = errorData.error || t('failedToFetchTranscript');
        throw new Error(errorMessage);
      }

      trickle.jump(92, t('processing'), 99);

      const transcriptDataJSON = await transcriptResponse.json();
      const { transcript, title, description, tokenCount, fetcher, fileId } = transcriptDataJSON;

      // Token limit checks
      if (!user && tokenCount > 32768) {
        setError(t('guestInputTooLong'));
        setIsLoading(false);
        return;
      }

      if (user && userPlan === 'free' && tokenCount > 65536) {
        setShowTokenLimitUpgrade(true);
        setError(t('unpaidInputTooLong'));
        setIsLoading(false);
        return;
      }

      markTrialUsed();
      trickle.finish();

      posthog.capture('file_uploaded', {
        upload_type: 'youtube',
        token_count: tokenCount,
      });

      navigateToSummary(fileId, {
        videoId,
        locale,
        contentLanguage,
        transcriptText: transcript,
        title: title || 'Untitled',
        videoDescription: description || '',
        tokenCount,
        fetcher,
        sourceType: 'youtube' as const,
      });

    } catch (err: any) {
      if (!showTokenLimitUpgrade && !trialLimitExceeded) {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
      trickle.reset();
    }
  }, [url, user, checkTrialAndPlan, planLoaded, userPlan, isHydrated, locale, activeFolder, t, openSubscriptionModal, markTrialUsed, navigateToSummary, showTokenLimitUpgrade, trialLimitExceeded]);

  const submitPdfWithFile = useCallback(async (file: File) => {
    setError("");
    setShowTokenLimitUpgrade(false);
    setTrialLimitExceeded(false);

    if (!checkTrialAndPlan()) return;

    setIsLoading(true);
    trickle.start(t('extractingText'), 35);

    try {
      // Extract text on the client side
      const extractedText = await extractPdfText(file);

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error(t('fileSummarizer.errorNoTextExtracted'));
      }

      trickle.jump(40, t('uploadingFile'), 65);

      const contentLanguage = typeof window !== 'undefined'
        ? localStorage.getItem('contentLanguage') || locale
        : locale;

      // Upload PDF to storage via server endpoint
      let pdfUrl: string | null = null;
      if (user) {
        const uploadForm = new FormData();
        uploadForm.append('file', file);
        const uploadRes = await fetch('/api/files/pdf/upload', {
          method: 'POST',
          body: uploadForm,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          pdfUrl = uploadData.pdfUrl;
        }
      }

      trickle.jump(68, t('processing'), 95);

      // Send only text + metadata to API (no file binary)
      const response = await fetch('/api/files/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extractedText,
          fileName: file.name,
          locale,
          contentLanguage,
          folderId: activeFolder?.id || null,
          pdfUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process PDF');
      }

      const data = await response.json();
      const { transcript, title, tokenCount, fileId } = data;

      // Token limit checks
      if (!user && tokenCount > 32768) {
        setError(t('guestInputTooLong'));
        setIsLoading(false);
        return;
      }

      if (user && userPlan === 'free' && tokenCount > 65536) {
        setShowTokenLimitUpgrade(true);
        setError(t('unpaidInputTooLong'));
        setIsLoading(false);
        return;
      }

      markTrialUsed();
      trickle.finish();

      posthog.capture('file_uploaded', {
        upload_type: 'pdf',
        token_count: tokenCount,
      });

      const localPdfUrl = pdfUrl || URL.createObjectURL(file);

      navigateToSummary(fileId, {
        videoId: '',
        locale,
        contentLanguage,
        transcriptText: transcript,
        title: title || 'Untitled PDF',
        videoDescription: '',
        tokenCount,
        fetcher: 'pdf',
        sourceType: 'pdf' as const,
        pdfUrl: localPdfUrl,
      });

    } catch (err: any) {
      if (!showTokenLimitUpgrade && !trialLimitExceeded) {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
      trickle.reset();
    }
  }, [user, checkTrialAndPlan, userPlan, isHydrated, locale, activeFolder, t, markTrialUsed, navigateToSummary, showTokenLimitUpgrade, trialLimitExceeded]);

  const submitAudioFile = useCallback(async (file: File) => {
    setError("");
    setShowTokenLimitUpgrade(false);
    setTrialLimitExceeded(false);

    if (!checkTrialAndPlan()) return;

    setIsLoading(true);
    trickle.start(t('transcribingAudio'), 90);

    try {
      const contentLanguage = typeof window !== 'undefined'
        ? localStorage.getItem('contentLanguage') || locale
        : locale;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('locale', locale);
      formData.append('contentLanguage', contentLanguage);
      if (activeFolder?.id) {
        formData.append('folderId', activeFolder.id);
      }

      const response = await fetch('/api/files/audio', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process audio');
      }

      trickle.jump(92, t('processing'), 99);

      const data = await response.json();
      const { transcript, title, tokenCount, fileId, audioUrl } = data;

      if (!user && tokenCount > 32768) {
        setError(t('guestInputTooLong'));
        setIsLoading(false);
        return;
      }

      if (user && userPlan === 'free' && tokenCount > 65536) {
        setShowTokenLimitUpgrade(true);
        setError(t('unpaidInputTooLong'));
        setIsLoading(false);
        return;
      }

      markTrialUsed();
      trickle.finish();

      posthog.capture('file_uploaded', {
        upload_type: 'audio_file',
        token_count: tokenCount,
      });

      const localAudioUrl = audioUrl || URL.createObjectURL(file);

      navigateToSummary(fileId, {
        videoId: '',
        locale,
        contentLanguage,
        transcriptText: transcript,
        title: title || 'Audio Recording',
        videoDescription: '',
        tokenCount,
        fetcher: 'audio',
        sourceType: 'audio' as const,
        audioUrl: localAudioUrl,
      });

    } catch (err: any) {
      if (!showTokenLimitUpgrade && !trialLimitExceeded) {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
      trickle.reset();
    }
  }, [user, checkTrialAndPlan, userPlan, isHydrated, locale, activeFolder, t, markTrialUsed, navigateToSummary, showTokenLimitUpgrade, trialLimitExceeded]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
        posthog.capture('file_uploaded', {
          upload_type: 'audio_recording',
          recording_duration: recordingTime,
        });
        submitAudioFile(file);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      setError('Microphone access denied');
    }
  }, [submitAudioFile]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  }, [isRecording]);

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 100 * 1024 * 1024) {
        setError('File size must be under 100MB');
        return;
      }
      setError('');
      submitAudioFile(file);
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    submitVideo();
  };

  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback((file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be under 50MB');
      return;
    }
    setPdfFile(file);
    setError('');
    // Auto-submit after a tick so state is updated
    setTimeout(() => {
      submitPdfWithFile(file);
    }, 0);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (inputMode === 'audio') {
      submitAudioFile(file);
    } else {
      processFile(file);
    }
  }, [processFile, submitAudioFile, inputMode]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto py-2 space-y-2">
      {/* Login Modal/Overlay */}
      {showLoginPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-card text-card-foreground p-8 rounded-lg shadow-lg max-w-sm w-full text-center">
              <h2 className="text-xl font-bold mb-4">{t('signIn')}</h2>
              <p className="mb-6">{t('trialUsedPrompt')}</p>
              <Button
                className="w-full bg-foreground hover:opacity-90 text-background mb-2"
                onClick={() => { setShowLoginPrompt(false); signInWithGoogle(); }}
              >
                {t('signInWithGoogle')}
              </Button>
                            <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowLoginPrompt(false)}
              >
                {t('cancel')}
              </Button>
            </div>
          </div>
        )}

      {/* Input Mode Tabs */}
      <div className="flex gap-2 justify-center mb-4">
        {([
          { mode: 'youtube' as InputMode, icon: YoutubeIcon, label: 'YouTube' },
          { mode: 'pdf' as InputMode, icon: FileText, label: 'PDF' },
          { mode: 'audio' as InputMode, icon: Headphones, label: 'Audio' },
        ]).map(({ mode, icon: Icon, label }) => (
          <button
            key={mode}
            type="button"
            onClick={() => { setInputMode(mode); setError(''); }}
            className="relative flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors"
          >
            {inputMode === mode && (
              <motion.span
                layoutId="activeTab"
                className="absolute inset-0 bg-foreground rounded-full"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span className={`relative z-10 flex items-center gap-1.5 transition-colors duration-200 ${
              inputMode === mode ? 'text-background' : 'text-muted-foreground'
            }`}>
              <Icon className="h-4 w-4" />
              {label}
            </span>
          </button>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.webm"
        onChange={handleAudioFileChange}
        className="hidden"
      />

      <AnimatePresence mode="wait">
      {inputMode === 'youtube' ? (
        <motion.div
          key="youtube"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
        <form onSubmit={handleSubmit}>
          <div className="relative flex items-center">
            <Input
              type="url"
              placeholder={t('videoUrl')}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="border-input bg-background text-foreground placeholder:text-muted-foreground border pr-20 w-full rounded-full h-12 pl-4"
              required
              pattern="^https?://(www\.|m\.)?(youtube\.com/(watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/).+" // eslint-disable-line no-useless-escape
            />
            {url && (
              <button
                type="button"
                onClick={() => setUrl("")}
                className="absolute right-12 top-1/2 -translate-y-1/2 z-10 p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              disabled={isLoading || (!!user && !planLoaded)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </button>
          </div>
        </form>
        </motion.div>
      ) : inputMode === 'pdf' ? (
        <motion.div
          key="pdf"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
        <div
          onClick={() => !isLoading && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative border-2 border-dashed rounded-xl p-10 cursor-pointer ${
            isDragging
              ? 'border-foreground bg-muted'
              : 'border-muted-foreground/25 hover:border-foreground/50 hover:bg-muted/30'
          } ${isLoading ? 'pointer-events-none' : ''}`}
        >
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 w-full">
              <LoadingProgressBar progress={trickle.progress} label={trickle.label} />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-full bg-muted p-3">
                <Upload className="h-6 w-6 text-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  Drop your PDF here or <span className="text-foreground font-semibold">browse</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">PDF up to 50MB</p>
              </div>
            </div>
          )}
        </div>
        </motion.div>
      ) : inputMode === 'audio' ? (
        <motion.div
          key="audio"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
        <div className="space-y-3">
          {/* Upload audio file */}
          <div
            onClick={() => !isLoading && !isRecording && audioInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-xl p-6 cursor-pointer ${
              isDragging
                ? 'border-foreground bg-muted'
                : 'border-muted-foreground/25 hover:border-foreground/50 hover:bg-muted/30'
            } ${isLoading || isRecording ? 'pointer-events-none' : ''} ${isRecording ? 'opacity-60' : ''}`}
          >
            {isLoading && !isRecording ? (
              <div className="flex flex-col items-center gap-3 w-full">
                <LoadingProgressBar progress={trickle.progress} label={trickle.label} />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="rounded-full bg-muted p-3">
                  <Upload className="h-5 w-5 text-foreground" />
                </div>
                <p className="text-sm font-medium">
                  Upload audio file
                </p>
                <p className="text-xs text-muted-foreground">MP3, WAV, M4A, OGG, FLAC up to 100MB</p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Record audio */}
          <div className="flex flex-col items-center gap-3 p-6">
            {isRecording ? (
              <>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="rounded-full bg-foreground p-4 text-background hover:opacity-90 transition-colors animate-pulse"
                >
                  <Square className="h-6 w-6" />
                </button>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-foreground animate-pulse" />
                  <span className="text-sm font-medium">{formatRecordingTime(recordingTime)}</span>
                </div>
                <p className="text-xs text-muted-foreground">Click to stop and transcribe</p>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isLoading}
                  className="rounded-full bg-foreground p-4 text-background hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  <Mic className="h-6 w-6" />
                </button>
                <p className="text-sm font-medium">Record audio</p>
                <p className="text-xs text-muted-foreground">Click to start recording</p>
              </>
            )}
          </div>
        </div>
        </motion.div>
      ) : null}
      </AnimatePresence>

      {/* YouTube progress bar (shown below the input) */}
      {isLoading && inputMode === 'youtube' && (
        <div className="mt-6">
          <LoadingProgressBar progress={trickle.progress} label={trickle.label} />
        </div>
      )}

      <div>
        {!user && (
            <p className="text-sm text-zinc-500 text-center mt-4 mb-4">{t('trialInfo')}</p>
        )}
      </div>

      {inAppBrowser && (
        <div className="mt-4 bg-red-100 text-red-700 p-4 rounded-md text-base font-semibold flex flex-col items-center mb-4">
          <p className="text-center">
            {t('inAppBrowserWarning.line1')} <br />
            {t('inAppBrowserWarning.line2')}
          </p>
          <button
            className="mt-2 px-3 py-1 bg-red-200 rounded text-red-900 font-bold"
            onClick={() => navigator.clipboard.writeText(window.location.href)}
          >
            {t('copyCurrentUrl')}
          </button>
        </div>
      )}

      {(showTokenLimitUpgrade || trialLimitExceeded) && (
        <div className="mt-4">
          <Alert variant="destructive" className="bg-yellow-50 border-yellow-300 text-yellow-800 mt-4">
            <AlertCircle className="h-4 w-4 !text-yellow-700" />
            <AlertDescription>
              {showTokenLimitUpgrade ? t('unpaidInputTooLong') : t('trialLimitExceededError')}
              <br />
              {t('subCTA')}
              <br />
              <button
                onClick={openSubscriptionModal}
                className="underline font-bold hover:text-yellow-900"
              >
                {t('upgrade')}
              </button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {error && !showTokenLimitUpgrade && !trialLimitExceeded && (
        <Alert variant="destructive" className="mt-4 bg-red-50 border-red-200 text-red-600">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
