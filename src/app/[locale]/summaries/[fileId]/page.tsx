"use client";

import { useEffect, useState, useRef, useContext } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { useSummaryGeneration } from '@/contexts/SummaryGenerationContext';
import { VideoPlayerProvider } from '@/contexts/VideoPlayerContext';
import { SidebarRefreshContext } from '@/components/home/SidebarLayout';
import { VideoPlayer } from '@/components/youtube/VideoPlayer';
import { TranscriptPanel } from '@/components/youtube/TranscriptPanel';
import Mindmap from '@/components/youtube/Mindmap';
import Quiz from '@/components/youtube/Quiz';
import Chat from '@/components/youtube/Chat';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import SummaryContent from '@/components/youtube/SummaryContent';
import { useMediaQuery } from '@/hooks/use-media-query';

export default function SummaryDetailPage() {
  const params = useParams();
  const locale = params.locale as string;
  const fileId = params.fileId as string | undefined;
  const { user, isLoading: authLoading } = useAuth();
  const { generationData } = useSummaryGeneration();
  const t = useTranslations();
  const refreshSidebar = useContext(SidebarRefreshContext);

  const [summary, setSummary] = useState<any>(null);
  const [folder, setFolder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Streaming state
  const [summaryText, setSummaryText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const hasStartedStreaming = useRef(false);

  // UI state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const isPreviewMode = fileId === 'preview';

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (isPreviewMode) {
      const { transcriptData, folderForSummary } = generationData;

      if (transcriptData) {
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
    } catch (err) {
      setError('Failed to load summary');
    } finally {
      setLoading(false);
    }
  };

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
          videoId: summary.video_id,
          contentLanguage: summary.content_language || locale,
          transcriptText: summary.transcript,
          title: summary.name,
          videoDescription: summary.description || '',
          tokenCount: summary.input_token_count || 0,
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
      if (fileId && fileId !== 'preview' && user) {
        try {
          await fetch(`/api/files/${fileId}`, {
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

  // Service tabs content
  const serviceTabs = (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
      <div className="relative flex items-center justify-center px-4 py-2">
        <TabsList className={`grid ${isFullscreen || !isDesktop ? 'grid-cols-5' : 'grid-cols-4'}`}>
          <TabsTrigger value="summary">{t('summaryTab')}</TabsTrigger>
          <TabsTrigger value="mindmap">{t('mindmapTab')}</TabsTrigger>
          <TabsTrigger value="quiz">{t('quizTab')}</TabsTrigger>
          {(isFullscreen || !isDesktop) && (
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
                <SummaryContent summaryText={summaryText} isStreaming={isStreaming} />
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
            fileId={isPreviewMode ? null : fileId}
            isActive={activeTab === 'mindmap'}
          />
        </div>

        <div className={`absolute inset-0 bg-background ${activeTab === 'quiz' ? 'z-10' : 'opacity-0 pointer-events-none select-none'}`}>
          <Quiz
            transcript={summary.transcript}
            quizData={summary.quiz}
            locale={locale}
            contentLanguage={contentLanguage}
            fileId={isPreviewMode ? null : (fileId || null)}
            title={summary.name}
          />
        </div>

        {(isFullscreen || !isDesktop) && (
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
            fileId={isPreviewMode ? null : (fileId || null)}
            title={summary.name}
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

  // Desktop split layout: video+transcript left, tabs right
  return (
    <VideoPlayerProvider>
      <div className="h-[calc(100vh-4rem)] overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left panel: Video + Transcript */}
          <ResizablePanel defaultSize={46} minSize={25} maxSize={60}>
            <div className="h-full flex flex-col">
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
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right panel: Service tabs */}
          <ResizablePanel defaultSize={54} minSize={40}>
            {serviceTabs}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </VideoPlayerProvider>
  );
}
