'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import SubscriptionPlans from './SubscriptionPlans';
import { PanelLeft } from 'lucide-react';

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

// Context for sidebar open state
export const SidebarOpenContext = createContext<boolean>(false);
export const useSidebarOpen = () => useContext(SidebarOpenContext);

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
      <SidebarOpenContext.Provider value={open}>
        <div className="flex relative flex-1">
          <button
            onClick={() => setOpen((o) => !o)}
            className={`fixed top-2 ${open ? 'left-52' : 'left-4'} z-40 flex items-center justify-center w-10 h-10 text-foreground bg-background rounded focus:outline-none transition-[left] duration-200 ease-out`}
            aria-label="Toggle sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          {/* Sidebar backdrop (mobile) */}
          {open && (
            <div
              className="fixed inset-0 bg-black/30 z-[29] lg:hidden"
              onClick={() => setOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside
            className={`fixed inset-y-0 left-0 w-64 bg-card text-card-foreground border-r z-30 transform transition-transform duration-200 ease-out
              ${open ? 'translate-x-0' : '-translate-x-full'}`}
          >
            <Sidebar refreshKey={refreshKey} />
          </aside>

          {/* Main content */}
          <main className={`flex-1 transition-[margin] duration-200 ease-out ${open ? 'lg:ml-64' : ''}`}>
            {children}
          </main>

          <SubscriptionPlans isOpen={isPlansModalOpen} onCloseAction={() => setIsPlansModalOpen(false)} />
        </div>
      </SidebarOpenContext.Provider>
      </SidebarRefreshContext.Provider>
    </FolderContext.Provider>
  );
} 