"use client";

import React, { useEffect, useState, useRef, useContext } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Loader2, Maximize2, Minimize2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSummaryGeneration } from '@/contexts/SummaryGenerationContext';
import { VideoPlayerProvider } from '@/contexts/VideoPlayerContext';
import { PdfViewerProvider } from '@/contexts/PdfViewerContext';
import { SidebarRefreshContext, useFolder } from '@/components/home/SidebarLayout';
import { VideoPlayer } from '@/components/youtube/VideoPlayer';
import { PdfViewer } from '@/components/pdf/PdfViewer';
import { AudioPlayer } from '@/components/audio/AudioPlayer';
import { TranscriptPanel } from '@/components/youtube/TranscriptPanel';
import Mindmap from '@/components/youtube/Mindmap';
import Quiz from '@/components/youtube/Quiz';
import Chat from '@/components/youtube/Chat';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import SummaryContent from '@/components/youtube/SummaryContent';
import SummaryActionButtons from '@/components/youtube/SummaryActionButtons';
import { Skeleton } from '@/components/ui/skeleton';
import { useMediaQuery } from '@/hooks/use-media-query';
import { extractVideoId } from '@/lib/utils';

export default function SummaryDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = params.locale as string;
  const fileId = params.fileId as string | undefined;
  const router = useRouter();
  const { user, isLoading: authLoading, signInWithGoogle } = useAuth();
  const { generationData } = useSummaryGeneration();
  const { activeFolder } = useFolder();
  const t = useTranslations();
  const refreshSidebar = useContext(SidebarRefreshContext);

  const [summary, setSummary] = useState<any>(null);
  const [folder, setFolder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);

  // Source type tracking
  const [sourceType, setSourceType] = useState<'youtube' | 'pdf' | 'audio'>('youtube');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Streaming state
  const [summaryText, setSummaryText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const hasStartedStreaming = useRef(false);

  // Bootstrap state (catch-all → summary page direct flow)
  const bootstrapStarted = useRef(false);
  const fileCreated = useRef(false);

  // UI state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const isPreviewMode = fileId === 'preview';

  // Bootstrap mode: when ?youtube= param is present (from catch-all redirect)
  useEffect(() => {
    const youtubeUrl = searchParams.get('youtube');
    if (!youtubeUrl || bootstrapStarted.current || authLoading) return;

    let decoded: string;
    try { decoded = decodeURIComponent(youtubeUrl); } catch { decoded = youtubeUrl; }

    const videoId = extractVideoId(decoded);
    if (!videoId) { setError('Invalid YouTube URL'); setLoading(false); return; }

    if (!user) {
      setShowSignInPrompt(true);
      setLoading(false);
      return;
    }

    bootstrapStarted.current = true;

    (async () => {
      try {
        const contentLanguage = localStorage.getItem('contentLanguage') || locale;
        const res = await fetch('/api/files/transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId, locale, contentLanguage,
            folderId: activeFolder?.id || null,
            fileId: fileId,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to fetch transcript');
        }
        const data = await res.json();

        fileCreated.current = !!data.fileId;

        // Clean URL: remove ?youtube= param
        window.history.replaceState({}, '', `/${locale}/files/${data.fileId || 'preview'}`);

        setSourceType('youtube');
        setSummary({
          id: data.fileId || null,
          name: data.title || 'Untitled',
          summary: '',
          video_id: videoId,
          created_at: null,
          locale,
          content_language: contentLanguage,
          transcript: data.transcript,
          description: data.description || '',
          mindmap: null, quiz: null,
          input_token_count: data.tokenCount,
        });
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to load video');
        setLoading(false);
      }
    })();
  }, [searchParams, authLoading, locale, activeFolder?.id, user, t]);

  // Existing data-loading effect (non-bootstrap)
  useEffect(() => {
    // Skip if in bootstrap mode
    if (searchParams.get('youtube') || bootstrapStarted.current) return;

    if (authLoading) {
      setLoading(true);
      return;
    }

    if (isPreviewMode) {
      const { transcriptData, folderForSummary } = generationData;

      if (transcriptData) {
        setSourceType(transcriptData.sourceType || 'youtube');
        setPdfUrl(transcriptData.pdfUrl || null);
        setAudioUrl(transcriptData.audioUrl || null);
        setSummary({
          id: null,
          name: transcriptData.title,
          summary: '',
          video_id: transcriptData.videoId,
          created_at: null,
          locale: locale,
          content_language: transcriptData.contentLanguage,
          transcript: transcriptData.transcriptText,
          description: transcriptData.videoDescription,
          mindmap: null,
          quiz: null,
          input_token_count: transcriptData.tokenCount,
        });
        setFolder(folderForSummary);
        setLoading(false);
      } else {
        setError('No data available. Please go back and try again.');
        setLoading(false);
      }
      return;
    }

    if (fileId && !summary) {
      if (user) {
        fetchExistingSummary(fileId);
      } else {
        const { transcriptData, folderForSummary } = generationData;
        if (transcriptData) {
          setSourceType(transcriptData.sourceType || 'youtube');
          setPdfUrl(transcriptData.pdfUrl || null);
          setAudioUrl(transcriptData.audioUrl || null);
          setSummary({
            id: fileId,
            name: transcriptData.title,
            summary: '',
            video_id: transcriptData.videoId,
            created_at: null,
            locale: locale,
            content_language: transcriptData.contentLanguage,
            transcript: transcriptData.transcriptText,
            description: transcriptData.videoDescription,
            mindmap: null,
            quiz: null,
            input_token_count: transcriptData.tokenCount,
          });
          setFolder(folderForSummary);
          setLoading(false);
        } else {
          setError('Please sign in to view this summary');
          setLoading(false);
        }
      }
    } else if (!fileId) {
      setLoading(true);
    }
  }, [fileId, generationData, locale, user?.id, authLoading, isPreviewMode]);

  const fetchExistingSummary = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/files/${id}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('Summary not found');
        } else if (response.status === 401) {
          setError('Please sign in to view this summary');
        } else {
          setError('Failed to load summary');
        }
        return;
      }

      const data = await response.json();
      console.log('[Page] fetchExistingSummary loaded:', {
        id: data.summary?.id,
        hasQuiz: !!data.summary?.quiz,
        quizLength: data.summary?.quiz?.length ?? 0,
        quizSample: data.summary?.quiz?.[0] ? JSON.stringify(data.summary.quiz[0]).slice(0, 100) : null,
        hasMindmap: !!data.summary?.mindmap,
        content_language: data.summary?.content_language,
      });
      setSummary(data.summary);
      setFolder(data.folder);

      // Determine source type from loaded data
      if (!data.summary.video_id) {
        const descUrl = data.summary.description || '';
        if (descUrl.startsWith('http') && descUrl.includes('/audios/')) {
          setSourceType('audio');
          setAudioUrl(descUrl);
        } else {
          setSourceType('pdf');
          if (descUrl.startsWith('http')) {
            setPdfUrl(descUrl);
          }
        }
      } else {
        setSourceType('youtube');
      }
    } catch (err) {
      setError('Failed to load summary');
    } finally {
      setLoading(false);
    }
  };

  // Compute effective fileId for save operations + child components
  const effectiveFileId = fileCreated.current ? (fileId || null) : (isPreviewMode ? null : fileId);

  // Start streaming summary generation if needed
  useEffect(() => {
    if (!summary || hasStartedStreaming.current) return;

    // If summary already exists, use it
    if (summary.summary && summary.summary.trim() !== '') {
      setSummaryText(summary.summary);
      return;
    }

    // Need to generate summary
    if (summary.transcript) {
      hasStartedStreaming.current = true;
      generateSummary();
    }
  }, [summary]);

  const generateSummary = async () => {
    if (!summary?.transcript) return;

    setIsStreaming(true);
    setSummaryText('');

    try {
      const response = await fetch('/api/files/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: summary.video_id || '',
          contentLanguage: summary.content_language || locale,
          transcriptText: summary.transcript,
          title: summary.name,
          videoDescription: summary.description || '',
          tokenCount: summary.input_token_count || 0,
          sourceType: sourceType,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate summary');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullSummary = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullSummary += chunk;
          setSummaryText(fullSummary);
        }
      }

      // Save the summary if we have a valid fileId
      if (effectiveFileId && user) {
        try {
          await fetch(`/api/files/${effectiveFileId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ summary: fullSummary }),
          });
          refreshSidebar();
        } catch (saveError) {
          console.error('Failed to save summary:', saveError);
        }
      }
    } catch (err: any) {
      console.error('Error generating summary:', err);
      setSummaryText('Failed to generate summary. Please try again.');
    } finally {
      setIsStreaming(false);
    }
  };

  const handleTryAgain = () => {
    hasStartedStreaming.current = false;
    generateSummary();
  };

  const dismissSignIn = () => {
    setShowSignInPrompt(false);
    router.push(`/${locale}`);
  };

  if (showSignInPrompt) {
    return (
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={dismissSignIn}
        >
          <motion.div
            className="bg-card text-card-foreground rounded-2xl shadow-2xl max-w-sm w-full p-8 relative"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={dismissSignIn}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-5">
                <svg className="h-6 w-6 text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  <path d="M5 3v4" />
                  <path d="M19 17v4" />
                  <path d="M3 5h4" />
                  <path d="M17 19h4" />
                </svg>
              </div>

              <h2 className="text-lg font-semibold mb-2">{t('signIn')}</h2>
              <p className="text-sm text-muted-foreground mb-6">{t('signInRequired')}</p>

              <Button
                className="w-full h-11 rounded-lg bg-foreground hover:opacity-90 text-background font-medium flex items-center justify-center gap-3"
                onClick={() => { setShowSignInPrompt(false); signInWithGoogle(); }}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {t('signInWithGoogle')}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] overflow-hidden">
        {isDesktop ? (
          <div className="flex h-full">
            {/* Left panel skeleton */}
            <div className="w-[46%] p-2 flex flex-col gap-2">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <div className="flex-1 space-y-3 p-4">
                {[85, 72, 90, 78, 95, 82, 88, 76].map((w, i) => (
                  <Skeleton key={i} className="h-4 w-full" style={{ width: `${w}%` }} />
                ))}
              </div>
            </div>
            {/* Right panel skeleton */}
            <div className="flex-1 flex flex-col p-4 gap-4">
              <div className="flex justify-center">
                <Skeleton className="h-10 w-72 rounded-full" />
              </div>
              <div className="space-y-4 p-2">
                <Skeleton className="h-5 w-48" />
                <div className="space-y-2.5">
                  {[88, 74, 92, 68, 85, 79].map((w, i) => (
                    <Skeleton key={i} className="h-4" style={{ width: `${w}%` }} />
                  ))}
                </div>
                <Skeleton className="h-5 w-40 mt-4" />
                <div className="space-y-2.5">
                  {[82, 70, 90, 75].map((w, i) => (
                    <Skeleton key={i} className="h-4" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Mobile skeleton */
          <div className="flex flex-col p-4 gap-4">
            <div className="flex justify-center">
              <Skeleton className="h-10 w-72 rounded-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-5 w-48" />
              <div className="space-y-2.5">
                {[80, 68, 92, 75, 87, 72, 95, 83].map((w, i) => (
                  <Skeleton key={i} className="h-4" style={{ width: `${w}%` }} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex justify-center items-center h-full">
        <p className="text-gray-500">No summary data available</p>
      </div>
    );
  }

  const contentLanguage = summary.content_language || locale;
  const isPdf = sourceType === 'pdf';
  const isAudio = sourceType === 'audio';
  const hideTranscriptTab = isPdf; // Audio keeps transcript tab, PDF doesn't

  // Service tabs content
  const serviceTabs = (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
      <div className="relative flex items-center justify-center px-4 py-2">
        <TabsList className={`grid ${
          hideTranscriptTab
            ? 'grid-cols-4'
            : (isFullscreen || !isDesktop ? 'grid-cols-5' : 'grid-cols-4')
        }`}>
          <TabsTrigger value="summary">{t('summaryTab')}</TabsTrigger>
          <TabsTrigger value="mindmap">{!isDesktop ? t('mindmapTabShort') : t('mindmapTab')}</TabsTrigger>
          <TabsTrigger value="quiz">{t('quizTab')}</TabsTrigger>
          {!hideTranscriptTab && (isFullscreen || !isDesktop) && (
            <TabsTrigger value="transcript">{t('transcriptTab')}</TabsTrigger>
          )}
          <TabsTrigger value="chat">{t('chatTab')}</TabsTrigger>
        </TabsList>
        {isDesktop && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="absolute right-4"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-hidden w-full relative">
        <div className={`absolute inset-0 bg-background transition-all duration-300 ease-in-out ${activeTab === 'summary' ? 'z-10 opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none select-none'}`}>
          <ScrollArea className="h-full p-6">
            <div className="max-w-4xl mx-auto">
              {isStreaming && !summaryText && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('generatingSummary')}</span>
                </div>
              )}
              {summaryText && (
                <>
                  <SummaryContent summaryText={summaryText} isStreaming={isStreaming} />
                  <SummaryActionButtons
                    summaryText={summaryText}
                    fileId={effectiveFileId || null}
                    isStreaming={isStreaming}
                    onTryAgain={handleTryAgain}
                  />
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className={`absolute inset-0 bg-background transition-all duration-300 ease-in-out ${activeTab === 'mindmap' ? 'z-10 opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none select-none'}`}>
          <Mindmap
            transcript={summary.transcript}
            title={summary.name}
            mindmap={summary.mindmap}
            locale={locale}
            contentLanguage={contentLanguage}
            fileId={effectiveFileId || null}
            isActive={activeTab === 'mindmap'}
            sourceType={sourceType}
            tokenCount={summary.input_token_count}
          />
        </div>

        <div className={`absolute inset-0 bg-background transition-all duration-300 ease-in-out ${activeTab === 'quiz' ? 'z-10 opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none select-none'}`}>
          <Quiz
            transcript={summary.transcript}
            quizData={summary.quiz}
            locale={locale}
            contentLanguage={contentLanguage}
            fileId={effectiveFileId || null}
            title={summary.name}
            sourceType={sourceType}
            tokenCount={summary.input_token_count}
          />
        </div>

        {!hideTranscriptTab && (isFullscreen || !isDesktop) && (
          <div className={`absolute inset-0 bg-background transition-all duration-300 ease-in-out ${activeTab === 'transcript' ? 'z-10 opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none select-none'}`}>
            <ScrollArea className="h-full p-6">
              <div className="max-w-4xl mx-auto">
                <TranscriptPanel transcript={summary.transcript} />
              </div>
            </ScrollArea>
          </div>
        )}

        <div className={`absolute inset-0 bg-background transition-all duration-300 ease-in-out ${activeTab === 'chat' ? 'z-10 opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none select-none'}`}>
          <Chat
            summary={summaryText}
            transcript={summary.transcript}
            locale={locale}
            contentLanguage={contentLanguage}
            fileId={effectiveFileId || null}
            title={summary.name}
            sourceType={sourceType}
            tokenCount={summary.input_token_count}
          />
        </div>
      </div>
    </Tabs>
  );

  // Conditional PDF provider wrapper
  const MaybePdfProvider = isPdf ? PdfViewerProvider : React.Fragment;

  const showSplitLayout = isDesktop && !isFullscreen;

  const leftPanel = (
    <div className="h-full flex flex-col">
      {isPdf ? (
        <div className="h-full p-2">
          {pdfUrl ? (
            <PdfViewer pdfUrl={pdfUrl} title={summary.name} />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              PDF preview not available
            </div>
          )}
        </div>
      ) : isAudio ? (
        <>
          <div className="flex-shrink-0 p-2" style={{ maxHeight: '280px' }}>
            {audioUrl ? (
              <AudioPlayer audioUrl={audioUrl} title={summary.name} />
            ) : (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                Audio preview not available
              </div>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <TranscriptPanel transcript={summary.transcript} />
            </ScrollArea>
          </div>
        </>
      ) : (
        <>
          <div className="flex-shrink-0 p-2">
            <div className="aspect-video">
              <VideoPlayer videoId={summary.video_id} title={summary.name} />
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <TranscriptPanel transcript={summary.transcript} />
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  );

  return (
    <VideoPlayerProvider>
      <MaybePdfProvider>
        <div className="h-[calc(100vh-4rem)] flex overflow-hidden">
          <div className={`h-full flex-shrink-0 ${showSplitLayout ? 'w-[46%] min-w-[25%] max-w-[60%]' : 'hidden'}`}>
            {leftPanel}
          </div>
          <div className="h-full flex-1 flex flex-col min-w-0">
            {serviceTabs}
          </div>
        </div>
      </MaybePdfProvider>
    </VideoPlayerProvider>
  );
}
