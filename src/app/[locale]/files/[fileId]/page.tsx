"use client";

import { useEffect, useState, useRef, useContext } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { useSummaryGeneration } from '@/contexts/SummaryGenerationContext';
import { VideoPlayerProvider } from '@/contexts/VideoPlayerContext';
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
import { useMediaQuery } from '@/hooks/use-media-query';
import { extractVideoId } from '@/lib/utils';

export default function SummaryDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = params.locale as string;
  const fileId = params.fileId as string | undefined;
  const { user, isLoading: authLoading } = useAuth();
  const { generationData } = useSummaryGeneration();
  const { activeFolder } = useFolder();
  const t = useTranslations();
  const refreshSidebar = useContext(SidebarRefreshContext);

  const [summary, setSummary] = useState<any>(null);
  const [folder, setFolder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    // Guest trial check
    if (!user) {
      const trialUsed = localStorage.getItem('trialUsed') === 'true';
      if (trialUsed) {
        setError(t('trialUsedPrompt'));
        setLoading(false);
        return;
      }
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

        // Mark guest trial as used
        if (!user) {
          localStorage.setItem('trialUsed', 'true');
        }

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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full mt-[20%]">
        <Loader2 className="h-10 w-10 animate-spin" />
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
        <div className={`absolute inset-0 bg-background ${activeTab === 'summary' ? 'z-10' : 'opacity-0 pointer-events-none select-none'}`}>
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

        <div className={`absolute inset-0 bg-background ${activeTab === 'mindmap' ? 'z-10' : 'opacity-0 pointer-events-none select-none'}`}>
          <Mindmap
            transcript={summary.transcript}
            title={summary.name}
            mindmap={summary.mindmap}
            locale={locale}
            contentLanguage={contentLanguage}
            fileId={effectiveFileId || null}
            isActive={activeTab === 'mindmap'}
          />
        </div>

        <div className={`absolute inset-0 bg-background ${activeTab === 'quiz' ? 'z-10' : 'opacity-0 pointer-events-none select-none'}`}>
          <Quiz
            transcript={summary.transcript}
            quizData={summary.quiz}
            locale={locale}
            contentLanguage={contentLanguage}
            fileId={effectiveFileId || null}
            title={summary.name}
          />
        </div>

        {!hideTranscriptTab && (isFullscreen || !isDesktop) && (
          <div className={`absolute inset-0 bg-background ${activeTab === 'transcript' ? 'z-10' : 'opacity-0 pointer-events-none select-none'}`}>
            <ScrollArea className="h-full p-6">
              <div className="max-w-4xl mx-auto">
                <TranscriptPanel transcript={summary.transcript} />
              </div>
            </ScrollArea>
          </div>
        )}

        <div className={`absolute inset-0 bg-background ${activeTab === 'chat' ? 'z-10' : 'opacity-0 pointer-events-none select-none'}`}>
          <Chat
            summary={summaryText}
            transcript={summary.transcript}
            locale={locale}
            contentLanguage={contentLanguage}
            fileId={effectiveFileId || null}
            title={summary.name}
            sourceType={sourceType}
          />
        </div>
      </div>
    </Tabs>
  );

  // Mobile layout: tabs only
  if (!isDesktop) {
    return (
      <VideoPlayerProvider>
        <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
          {serviceTabs}
        </div>
      </VideoPlayerProvider>
    );
  }

  // Desktop fullscreen layout: tabs only
  if (isFullscreen) {
    return (
      <VideoPlayerProvider>
        <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
          {serviceTabs}
        </div>
      </VideoPlayerProvider>
    );
  }

  // Desktop split layout: viewer+transcript left, tabs right
  return (
    <VideoPlayerProvider>
      <div className="h-[calc(100vh-4rem)] overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left panel: Video/PDF + Transcript */}
          <ResizablePanel defaultSize={46} minSize={25} maxSize={60}>
            <div className="h-full flex flex-col">
              {isPdf ? (
                /* PDF viewer takes full height */
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
                  {/* Audio player */}
                  <div className="flex-shrink-0 p-2" style={{ maxHeight: '280px' }}>
                    {audioUrl ? (
                      <AudioPlayer audioUrl={audioUrl} title={summary.name} />
                    ) : (
                      <div className="flex items-center justify-center h-40 text-muted-foreground">
                        Audio preview not available
                      </div>
                    )}
                  </div>
                  {/* Transcript - fills remaining space */}
                  <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                      <TranscriptPanel transcript={summary.transcript} />
                    </ScrollArea>
                  </div>
                </>
              ) : (
                <>
                  {/* Video player - fixed aspect ratio */}
                  <div className="flex-shrink-0 p-2">
                    <div className="aspect-video">
                      <VideoPlayer videoId={summary.video_id} title={summary.name} />
                    </div>
                  </div>
                  {/* Transcript - fills remaining space */}
                  <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                      <TranscriptPanel transcript={summary.transcript} />
                    </ScrollArea>
                  </div>
                </>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Right panel: Service tabs */}
          <ResizablePanel defaultSize={54} minSize={40}>
            {serviceTabs}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </VideoPlayerProvider>
  );
}
