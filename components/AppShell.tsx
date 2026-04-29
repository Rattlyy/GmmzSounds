"use client";

import { useEffect, useState } from "react";
import { Menu, X, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/Sidebar";
import type { Playlist } from "@/lib/db";

type PlaylistWithCount = Playlist & { songCount?: number };

interface Props {
  children: React.ReactNode;
  playlists: PlaylistWithCount[];
}

export default function AppShell({ children, playlists }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1280px)");

    const syncSidebar = () => {
      setIsDesktop(mediaQuery.matches);
      setSidebarOpen(mediaQuery.matches);
    };

    syncSidebar();
    mediaQuery.addEventListener("change", syncSidebar);

    return () => mediaQuery.removeEventListener("change", syncSidebar);
  }, []);

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      <header className="border-b border-border px-4 sm:px-6 py-4 flex items-center gap-3 shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          aria-expanded={sidebarOpen}
          onClick={() => setSidebarOpen((open) => !open)}
        >
          {sidebarOpen ? (
            <X className="h-4 w-4" />
          ) : (
            <Menu className="h-4 w-4" />
          )}
        </Button>
        <Music2 className="h-6 w-6 text-primary shrink-0" />
        <h1 className="text-xl font-bold tracking-tight">YTDLPSync</h1>
        <span className="hidden sm:inline text-muted-foreground text-sm ml-1">
          SoundCloud downloader
        </span>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar overlay"
            className="absolute inset-0 z-30 bg-background/60 backdrop-blur-[1px] xl:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <Sidebar
          playlists={playlists}
          open={sidebarOpen}
          desktop={isDesktop}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 overflow-hidden flex flex-col min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}