"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { YoutubeIcon, AlertCircle, X, Loader2, FileText, Upload, Mic, Square, Headphones } from "lucide-react";
import { useTranslations } from 'next-intl';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from "@/contexts/AuthContext";
import { useFolder } from '../home/SidebarLayout';
import { useSummaryGeneration } from '@/contexts/SummaryGenerationContext';
import { useHydration } from '@/hooks/useHydration';
import { extractVideoId } from '@/lib/utils';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface FolderType {
  id: string;
  name: string;
}

type InputMode = 'youtube' | 'pdf' | 'audio';

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
    }
  }, [url, user, checkTrialAndPlan, planLoaded, userPlan, isHydrated, locale, activeFolder, t, openSubscriptionModal, markTrialUsed, navigateToSummary, showTokenLimitUpgrade, trialLimitExceeded]);

  const submitPdfWithFile = useCallback(async (file: File) => {
    setError("");
    setShowTokenLimitUpgrade(false);
    setTrialLimitExceeded(false);

    if (!checkTrialAndPlan()) return;

    setIsLoading(true);

    try {
      // Extract text on the client side
      const extractedText = await extractPdfText(file);

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error(t('fileSummarizer.errorNoTextExtracted'));
      }

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
    }
  }, [user, checkTrialAndPlan, userPlan, isHydrated, locale, activeFolder, t, markTrialUsed, navigateToSummary, showTokenLimitUpgrade, trialLimitExceeded]);

  const submitAudioFile = useCallback(async (file: File) => {
    setError("");
    setShowTokenLimitUpgrade(false);
    setTrialLimitExceeded(false);

    if (!checkTrialAndPlan()) return;

    setIsLoading(true);

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
        <button
          type="button"
          onClick={() => { setInputMode('youtube'); setError(''); }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            inputMode === 'youtube'
              ? 'bg-red-600 text-white'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          <YoutubeIcon className="h-4 w-4" />
          YouTube
        </button>
        <button
          type="button"
          onClick={() => { setInputMode('pdf'); setError(''); }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            inputMode === 'pdf'
              ? 'bg-blue-600 text-white'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          <FileText className="h-4 w-4" />
          PDF
        </button>
        <button
          type="button"
          onClick={() => { setInputMode('audio'); setError(''); }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            inputMode === 'audio'
              ? 'bg-purple-600 text-white'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          <Headphones className="h-4 w-4" />
          Audio
        </button>
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

      {inputMode === 'youtube' ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Input
                type="url"
                placeholder={t('videoUrl')}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="border-input bg-background text-foreground placeholder:text-muted-foreground border pr-10 w-full"
                required
                pattern="^https?://(www\.|m\.)?(youtube\.com/(watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/).+" // eslint-disable-line no-useless-escape
              />
              {url && (
                <button
                  type="button"
                  onClick={() => setUrl("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1 text-gray-400 hover:text-red-500 bg-background rounded-full"
                  style={{ boxShadow: '0 0 2px rgba(0,0,0,0.05)' }}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Button
              type="submit"
              disabled={isLoading || (!!user && !planLoaded)}
              className="bg-red-600 hover:bg-red-700 text-white whitespace-nowrap"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <YoutubeIcon className="mr-2 h-4 w-4" />
              )}
              <span className="block sm:hidden">{isLoading ? t('loadingShort') : t('submitUrlShort')}</span>
              <span className="hidden sm:block">{isLoading ? t('loading') : t('submitUrl')}</span>
            </Button>
          </div>
        </form>
      ) : inputMode === 'pdf' ? (
        <div
          onClick={() => !isLoading && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative border-2 border-dashed rounded-xl p-10 cursor-pointer transition-all ${
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
              : 'border-muted-foreground/25 hover:border-blue-400 hover:bg-muted/30'
          } ${isLoading ? 'pointer-events-none opacity-60' : ''}`}
        >
          {isLoading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm text-muted-foreground">{t('loading')}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-3">
                <Upload className="h-6 w-6 text-blue-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  Drop your PDF here or <span className="text-blue-600">browse</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">PDF up to 50MB</p>
              </div>
            </div>
          )}
        </div>
      ) : inputMode === 'audio' ? (
        <div className="space-y-3">
          {/* Upload audio file */}
          <div
            onClick={() => !isLoading && !isRecording && audioInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all ${
              isDragging
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20'
                : 'border-muted-foreground/25 hover:border-purple-400 hover:bg-muted/30'
            } ${isLoading || isRecording ? 'pointer-events-none opacity-60' : ''}`}
          >
            {isLoading && !isRecording ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                <p className="text-sm text-muted-foreground">Transcribing audio...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="rounded-full bg-purple-100 dark:bg-purple-900/30 p-3">
                  <Upload className="h-5 w-5 text-purple-600" />
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
                  className="rounded-full bg-red-600 p-4 text-white hover:bg-red-700 transition-colors animate-pulse"
                >
                  <Square className="h-6 w-6" />
                </button>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
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
                  className="rounded-full bg-purple-600 p-4 text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  <Mic className="h-6 w-6" />
                </button>
                <p className="text-sm font-medium">Record audio</p>
                <p className="text-xs text-muted-foreground">Click to start recording</p>
              </>
            )}
          </div>
        </div>
      ) : null}

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
