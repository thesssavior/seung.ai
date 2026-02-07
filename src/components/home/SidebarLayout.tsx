'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import SubscriptionPlans from './SubscriptionPlans';
import { ChevronLeft, Menu } from 'lucide-react';

export interface FolderType {
  id: string;
  name: string;
}

interface FolderContextType {
  activeFolder: FolderType | null;
  setActiveFolder: (folder: FolderType | null) => void;
  openSubscriptionModal: () => void;
}

export const FolderContext = createContext<FolderContextType>({
  activeFolder: null,
  setActiveFolder: () => {},
  openSubscriptionModal: () => {},
});

export const useFolder = () => useContext(FolderContext);

// Context to allow children to trigger sidebar refresh
export const SidebarRefreshContext = createContext<() => void>(() => {});

export default function SidebarLayout({ children }: { children: React.ReactNode }) {

  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-open');
    if (saved !== null) setOpen(saved === 'true');
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) localStorage.setItem('sidebar-open', String(open)); }, [open, hydrated]);
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshSidebar = () => setRefreshKey(k => k + 1);

  const [activeFolder, setActiveFolder] = useState<FolderType | null>(null);
  const [isPlansModalOpen, setIsPlansModalOpen] = useState(false);

  const openSubscriptionModal = () => setIsPlansModalOpen(true);

  return (
    <FolderContext.Provider value={{ activeFolder, setActiveFolder, openSubscriptionModal }}>
      <SidebarRefreshContext.Provider value={refreshSidebar}>
        <div className="flex relative flex-1">
          <button
            onClick={() => setOpen((o) => !o)}
            className={`fixed top-2 ${open ? 'left-52' : 'left-4'} z-20 flex items-center justify-center w-10 h-10 text-foreground bg-background rounded focus:outline-none`}
            aria-label="Toggle sidebar"
          >
            {open ? <ChevronLeft className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          {/* Sidebar: open on desktop, toggled on mobile */}
          <aside
            className={`fixed inset-y-0 left-0 w-64 bg-card text-card-foreground border-r z-10 transform transition-transform duration-200
              ${open ? 'translate-x-0' : '-translate-x-full'}`}
          >
            <Sidebar refreshKey={refreshKey} />
          </aside>

          {/* Main content */}
          <main className="flex-1">
            {children}
          </main>

          <SubscriptionPlans isOpen={isPlansModalOpen} onCloseAction={() => setIsPlansModalOpen(false)} />
        </div>
      </SidebarRefreshContext.Provider>
    </FolderContext.Provider>
  );
} 