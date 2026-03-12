'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Folder, ChevronDown, ChevronRight, User, Plus, Settings, Home, HelpCircle, Trash2, Pencil, Crown } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/ui/logo';
import { useFolder } from '@/components/home/SidebarLayout';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { useSearch } from '@/contexts/SearchContext';

interface FolderType { id: string; name: string; }
interface SummaryType { id: string; video_id: string; summary: string; name: string; }

// Helper to get initials from name
const getInitials = (name: string = '') => {
  return name
    .split(' ')
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

export default function Sidebar({ refreshKey }: { refreshKey?: number }) {
  const t = useTranslations();
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [folderSummaries, setFolderSummaries] = useState<{ [folderId: string]: SummaryType[] }>({});
  const [loadingSummaries, setLoadingSummaries] = useState<{ [folderId: string]: boolean }>({});
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [recentOpen, setRecentOpen] = useState(true);
  const [knowledgeOpen, setKnowledgeOpen] = useState(true);
  const [recents, setRecents] = useState<SummaryType[]>([]);
  const params = useParams();
  const locale = params.locale as string;
  const [inAppBrowser, setInAppBrowser] = useState(false);
  const { user, isLoading, signInWithGoogle } = useAuth();
  const { activeFolder, setActiveFolder, openSubscriptionModal } = useFolder();
  const [folderOpen, setFolderOpen] = useState<{ [folderId: string]: boolean }>({});
  const [hoveredFileId, setHoveredSummaryId] = useState<string | null>(null);
  const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);
  const [isMac, setIsMac] = useState(false);
  const [userPlan, setUserPlan] = useState<string>('free');
  const { openSearchModal } = useSearch();

  // Restore sidebar toggle states from localStorage after mount
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const savedRecent = localStorage.getItem('sidebar-recent-open');
    if (savedRecent !== null) setRecentOpen(savedRecent === 'true');
    const savedKnowledge = localStorage.getItem('sidebar-knowledge-open');
    if (savedKnowledge !== null) setKnowledgeOpen(savedKnowledge === 'true');
    try {
      const savedFolders = localStorage.getItem('sidebar-folder-open');
      if (savedFolders) setFolderOpen(JSON.parse(savedFolders));
    } catch {}
    setHydrated(true);
  }, []);

  // Persist sidebar toggle states after hydration
  useEffect(() => { if (hydrated) localStorage.setItem('sidebar-recent-open', String(recentOpen)); }, [recentOpen, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem('sidebar-knowledge-open', String(knowledgeOpen)); }, [knowledgeOpen, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem('sidebar-folder-open', JSON.stringify(folderOpen)); }, [folderOpen, hydrated]);

  const isSignedIn = !isLoading && !!user;

  // Fetch user plan
  useEffect(() => {
    const fetchPlan = async () => {
      if (user) {
        try {
          const res = await fetch('/api/home/user/plan');
          if (!res.ok) { setUserPlan('free'); return; }
          const data = await res.json();
          setUserPlan(data.plan || 'free');
        } catch {
          setUserPlan('free');
        }
      }
    };
    fetchPlan();
  }, [user]);

  // Fetch folders using api/folders
  const fetchFolders = async () => {
    setIsLoadingFolders(true);
    try {
      const res = await fetch('/api/folders');
      if (res.ok) {
        const data: FolderType[] = await res.json();
        setFolders(data);
        if (!activeFolder && data.length) {
          setActiveFolder(data[0]);
        } else if (data.length === 0) {
          setActiveFolder(null);
        }
      } else {
        setFolders([]);
        setActiveFolder(null);
      }
    } catch (error) {
      console.error("Error fetching folders:", error);
      setFolders([]);
      setActiveFolder(null);
    } finally {
      setIsLoadingFolders(false);
    }
  };

  // Fetch summaries for active folder
  const fetchSummaries = async (folderId: string) => {
    setLoadingSummaries(prev => ({ ...prev, [folderId]: true }));
    try {
      const res = await fetch(`/api/folders/${folderId}/summaries`);
      if (res.ok) {
        const data = await res.json();
        setFolderSummaries(prev => ({ ...prev, [folderId]: data }));
      } else {
        setFolderSummaries(prev => ({ ...prev, [folderId]: [] }));
      }
    } catch {
      setFolderSummaries(prev => ({ ...prev, [folderId]: [] }));
    } finally {
      setLoadingSummaries(prev => ({ ...prev, [folderId]: false }));
    }
  };

  // Fetch folders on signin, refreshKey
  useEffect(() => {
    if (isSignedIn) {
      setIsLoadingFolders(true);
      fetchFolders();
    } else {
      setFolders([]);
      setActiveFolder(null);
      setFolderSummaries({});
      setLoadingSummaries({});
    }
  }, [isSignedIn, refreshKey]);

  // Fetch summaries for active folder on change
  useEffect(() => {
    if (activeFolder) {
      setFolderOpen({ [activeFolder.id]: true });
      if (!folderSummaries[activeFolder.id]) {
        fetchSummaries(activeFolder.id);
      }
    } else {
      setFolderOpen({});
    }
  }, [activeFolder, refreshKey]);

  // Fetch recent summaries
  useEffect(() => {
    if (isSignedIn) {
      fetch('/api/folders/recent-summaries')
        .then(async (res) => {
          if (res.ok) {
            setRecents(await res.json());
          } else {
            setRecents([]);
          }
        })
        .catch(() => setRecents([]));
    } else {
      setRecents([]);
    }
  }, [isSignedIn, refreshKey]);

  // Folder operations
  const handleAddFolder = async () => {
    if (!newFolderName.trim()) return;
    const res = await fetch('/api/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newFolderName }) });
    if (res.ok) { setNewFolderName(''); setShowNewFolderInput(false); fetchFolders(); }
  };

  const handleRenameFolder = async (id: string) => {
    const name = prompt(t('Sidebar.renameFolder') || 'Rename folder');
    if (!name) return;
    await fetch(`/api/folders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    fetchFolders();
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm(t('Sidebar.confirmDeleteFolder') || 'Delete folder?')) return;
    await fetch(`/api/folders/${id}`, { method: 'DELETE' });
    if (activeFolder?.id === id) setActiveFolder(null);
    fetchFolders();
  };

  const handleDeleteSummary = async (folderId: string, fileId: string) => {
    if (!confirm(t('Sidebar.confirmDeleteSummary', { defaultValue: 'Delete this file?' }))) return;

    try {
      const res = await fetch(`/api/folders/${folderId}/summaries`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      });

      if (res.ok) {
        setFolderSummaries(prev => ({
          ...prev,
          [folderId]: prev[folderId]?.filter(s => s.id !== fileId) || [],
        }));
      } else {
        const errorData = await res.json();
        console.error("Failed to delete summary:", errorData.error);
        alert(t('Sidebar.deleteSummaryError', { defaultValue: 'Failed to delete summary. Please try again.' }));
      }
    } catch (error) {
      console.error("Error deleting summary:", error);
      alert(t('Sidebar.deleteSummaryError', { defaultValue: 'An error occurred while deleting the summary.' }));
    }
  };

  // Drag-and-drop handlers
  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    if (result.type === 'folder') {
      const reordered = Array.from(folders);
      const [removed] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, removed);
      setFolders(reordered);
      return;
    }
    if (result.type === 'summary') {
      const sourceFolderId = result.source.droppableId;
      const destFolderId = result.destination.droppableId;
      if (sourceFolderId === destFolderId) return;
      const summaryIdx = result.source.index;
      const summaryToMove = folderSummaries[sourceFolderId][summaryIdx];
      if (!summaryToMove) return;

      setFolderSummaries(prev => ({
        ...prev,
        [sourceFolderId]: prev[sourceFolderId].filter((_, i) => i !== summaryIdx),
        [destFolderId]: [...(prev[destFolderId] || []), summaryToMove]
      }));

      try {
        const response = await fetch(`/api/folders/${sourceFolderId}/summaries`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId: summaryToMove.id, targetFolderId: destFolderId }),
        });

        if (!response.ok) {
          setFolderSummaries(prev => ({
            ...prev,
            [sourceFolderId]: [...prev[sourceFolderId], summaryToMove],
            [destFolderId]: prev[destFolderId].filter(s => s.id !== summaryToMove.id)
          }));
          console.error('Failed to move summary');
        } else {
          fetchSummaries(sourceFolderId);
          if (folderSummaries[destFolderId] || folderOpen[destFolderId]) {
            fetchSummaries(destFolderId);
          }
        }
      } catch (error) {
        setFolderSummaries(prev => ({
          ...prev,
          [sourceFolderId]: [...prev[sourceFolderId], summaryToMove],
          [destFolderId]: prev[destFolderId].filter(s => s.id !== summaryToMove.id)
        }));
        console.error('Error moving summary:', error);
      }
    }
  };

  // Detect in-app browser and platform
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent || navigator.vendor;
      if (/KAKAOTALK/i.test(ua)) {
        setInAppBrowser(true);
      }
      setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0);
    }
  }, []);

  const toggleFolder = (folderId: string) => {
    setFolderOpen(prev => ({ ...prev, [folderId]: !prev[folderId] }));
    if (!folderOpen[folderId] && !folderSummaries[folderId]) {
      fetchSummaries(folderId);
    }
  };

  // Show login prompt if not signed in
  if (!isLoading && !user) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background p-6 text-center space-y-4">
        <User className="w-12 h-12 text-muted-foreground" />
        <p className="text-foreground text-lg font-medium">
          {t('signInDescription') || 'Please sign in to continue'}
        </p>
        {inAppBrowser ? (
          <div className="bg-destructive/10 text-destructive p-4 rounded-md text-base font-semibold">
            Google sign-in is blocked in this browser. Please open in Chrome or Safari.
          </div>
        ) : (
          <button
            onClick={signInWithGoogle}
            className="w-full px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md"
          >
            {t('signIn') || 'Sign In'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex flex-col items-center justify-center px-4 py-3">
        <span className="w-full flex justify-start">
          <Link href={`/${locale}`} className="flex items-center w-full justify-start">
            <Logo width={20} height={20} className="w-full h-auto max-w-[24px]" />
            <span className="text-lg font-medium ml-2 mt-1">Seung AI</span>
          </Link>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <ul className="space-y-1">
          <li>
            <Link href={`/${locale}`}>
              <div className="flex items-center gap-2 px-2 py-2 rounded hover:bg-accent font-medium">
                <Home className="w-4 h-4" /> {t('Sidebar.home', { defaultValue: 'Home' })}
              </div>
            </Link>
          </li>
          <li>
            <button
              onClick={openSearchModal}
              className="flex items-center justify-between w-full px-2 py-2 rounded hover:bg-accent font-medium text-left"
              title="Search (Ctrl+K)"
            >
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4" /> {t('Sidebar.search', { defaultValue: 'Search' })}
              </div>
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                {isMac ? '⌘K' : 'Ctrl+K'}
              </span>
            </button>
          </li>
          {/* Recent */}
          <li>
            <button
              className="flex items-center gap-2 w-full px-2 py-2 rounded hover:bg-accent font-medium"
              onClick={() => setRecentOpen(o => !o)}
            >
              {recentOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              {t('Sidebar.recent', { defaultValue: 'Recent' })}
            </button>
            {recentOpen && (
              <ul className="ml-6 mt-1 space-y-1">
                {recents.length === 0 && <li className="text-xs text-muted-foreground">No recent items</li>}
                {recents.map(r => (
                  <li key={r.id}>
                    <Link href={`/${locale}/files/${r.id}`} className="truncate text-sm text-foreground hover:underline cursor-pointer block">
                      {r.name || r.video_id}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
          {/* My Knowledge */}
          <li>
            <div className="flex items-center gap-2 w-full px-2 py-2 rounded hover:bg-accent font-medium">
              <button
                className="flex items-center gap-2 w-full"
                onClick={() => setKnowledgeOpen(o => !o)}
                style={{ flex: 1 }}
              >
                {knowledgeOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                {t('Sidebar.myKnowledge', { defaultValue: 'My Knowledge' })}
              </button>
              <button
                className="ml-1 text-xs text-muted-foreground hover:text-foreground"
                title="New folder"
                onClick={() => setShowNewFolderInput(true)}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {knowledgeOpen && (
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="folders-droppable" type="folder">
                  {(provided) => (
                    <ul className="ml-6 mt-1 space-y-1" ref={provided.innerRef} {...provided.droppableProps}>
                      {folders.map((f, idx) => (
                        <Draggable key={f.id} draggableId={f.id} index={idx}>
                          {(dragProvided) => (
                            <li ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}>
                              <Droppable droppableId={f.id} type="summary">
                                {(folderDropProvided, folderDropSnapshot) => (
                                  <div>
                                    <div
                                      ref={folderDropProvided.innerRef}
                                      {...folderDropProvided.droppableProps}
                                      className={`flex items-center gap-1 font-semibold text-foreground group ${activeFolder?.id === f.id || folderDropSnapshot.isDraggingOver ? 'bg-accent rounded px-1' : 'px-1'}`}
                                      onClick={() => setActiveFolder(f)}
                                      onMouseEnter={() => setHoveredFolderId(f.id)}
                                      onMouseLeave={() => setHoveredFolderId(null)}
                                    >
                                      <button
                                        className="mr-1"
                                        onClick={e => { e.stopPropagation(); toggleFolder(f.id); }}
                                        aria-label={folderOpen[f.id] ? 'Collapse folder' : 'Expand folder'}
                                      >
                                        {folderOpen[f.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                      </button>
                                      <Folder className="w-4 h-4" />
                                      <span className="mx-1 flex-1 text-left truncate font-normal">{f.name}</span>
                                      {hoveredFolderId === f.id && (
                                        <div className="flex items-center ml-auto">
                                          <button
                                            onClick={e => { e.stopPropagation(); handleRenameFolder(f.id); }}
                                            className="p-1 text-muted-foreground hover:text-foreground"
                                            title="Rename folder"
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={e => { e.stopPropagation(); handleDeleteFolder(f.id); }}
                                            className="p-1 text-muted-foreground hover:text-destructive"
                                            title="Delete folder"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </div>

                                    {folderOpen[f.id] && (
                                      <div className="ml-5 mt-1 space-y-1">
                                        {loadingSummaries[f.id] ? (
                                          <div className="text-xs text-muted-foreground">Loading...</div>
                                        ) : folderSummaries[f.id]?.length === 0 ? (
                                          <div className="text-xs text-muted-foreground">No summaries</div>
                                        ) : (
                                          folderSummaries[f.id].map((s, sIdx) => (
                                            <Draggable key={s.id} draggableId={s.id} index={sIdx}>
                                              {(summaryDragProvided) => (
                                                <div
                                                  ref={summaryDragProvided.innerRef}
                                                  {...summaryDragProvided.draggableProps}
                                                  {...summaryDragProvided.dragHandleProps}
                                                  className="flex items-center justify-between text-sm text-foreground hover:bg-accent rounded group"
                                                  onMouseEnter={() => setHoveredSummaryId(s.id)}
                                                  onMouseLeave={() => setHoveredSummaryId(null)}
                                                >
                                                  <Link href={`/${locale}/files/${s.id}`} className="truncate flex-grow px-1 hover:underline cursor-pointer block">
                                                    {s.name}
                                                  </Link>
                                                  {hoveredFileId === s.id && (
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteSummary(f.id, s.id);
                                                      }}
                                                      className="p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                      title="Delete summary"
                                                    >
                                                      <Trash2 className="w-3 h-3" />
                                                    </button>
                                                  )}
                                                </div>
                                              )}
                                            </Draggable>
                                          ))
                                        )}
                                      </div>
                                    )}

                                    {folderDropProvided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            </li>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {isLoadingFolders && (
                        <li className="ml-6 mt-1 space-y-1 text-xs text-muted-foreground">Loading...</li>
                      )}
                      {showNewFolderInput && (
                        <li className="flex items-center gap-1 bg-accent rounded px-1 py-1 mt-2">
                          <span className="flex items-center">
                            <Folder className="w-4 h-4 text-muted-foreground mr-1" />
                          </span>
                          <input
                            type="text"
                            className="flex-1 bg-transparent outline-none border-none text-sm px-1"
                            placeholder={t('Sidebar.newFolder')}
                            value={newFolderName}
                            onChange={e => setNewFolderName(e.target.value)}
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') handleAddFolder(); }}
                            style={{ minWidth: 0 }}
                          />
                          <button
                            onClick={handleAddFolder}
                            className="px-1 py-1 bg-muted text-foreground rounded text-xs shadow hover:bg-primary hover:text-primary-foreground transition-colors duration-150"
                            title="Add folder"
                          >
                            <Plus className="w-4 h-4 inline" />
                          </button>
                          <button
                            onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }}
                            className="px-1 py-1 bg-muted text-foreground rounded text-xs hover:bg-primary hover:text-primary-foreground transition-colors duration-150"
                            title="Cancel"
                          >Cancel</button>
                        </li>
                      )}
                    </ul>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </li>
        </ul>
      </nav>

      <div className="px-4 space-y-3 text-center hidden sm:block">
        <Link href={`/${locale}/community`}>
          <Button
            variant="ghost"
            title={t('helpAndCommunity')}
          >
            <span className="sm:hidden"><HelpCircle className="h-5 w-5" /></span>
            <span className="hidden sm:flex items-center space-x-2 gap-x-1">
              {t('helpAndCommunity')}
              <HelpCircle className="h-5 w-5" />
            </span>
          </Button>
        </Link>
      </div>

      {/* Footer Area */}
      <div className="px-4 py-3 space-y-3 border-t">
        {/* Upgrade Section */}
        {userPlan === 'premium' ? (
          <div className="bg-green-500/10 p-4 rounded-lg text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Crown className="w-5 h-5 text-green-600 dark:text-green-400" />
              <p className="text-sm font-semibold text-green-700 dark:text-green-300">{t('Sidebar.premiumActive')}</p>
            </div>
            <p className="text-xs text-green-600 dark:text-green-400">{t('Sidebar.premiumActiveSubtitle')}</p>
          </div>
        ) : (
          <div
            className="bg-muted p-4 rounded-lg text-center cursor-pointer hover:bg-accent transition-colors"
            onClick={openSubscriptionModal}
          >
            <button
              className="w-full bg-primary text-primary-foreground font-semibold py-2 px-4 rounded-md hover:bg-primary/90 transition-colors duration-200 text-sm flex items-center justify-center gap-2 mb-2"
            >
              <Crown className="w-4 h-4" />
              {t('Sidebar.upgrade')}
            </button>
            <p className="text-xs text-muted-foreground">{t('Sidebar.upgradeSubtitle')}</p>
          </div>
        )}

        {/* User Info Section */}
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.user_metadata?.avatar_url ?? undefined} alt={user?.user_metadata?.full_name ?? 'User'} />
            <AvatarFallback>{getInitials(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '')}</AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate text-foreground">{user?.user_metadata?.full_name || user?.user_metadata?.name}</p>
            <p className="text-xs truncate text-muted-foreground">{user?.email}</p>
          </div>
          <Link href={`/${locale}/settings`} className="flex items-center">
            <button className="text-muted-foreground hover:text-foreground" title="Settings">
              <Settings className="w-5 h-5" />
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
