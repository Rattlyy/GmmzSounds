import { getAllPlaylists, getSongsForPlaylist } from "@/lib/db";
import Sidebar from "@/components/Sidebar";
import { Music2 } from "lucide-react";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch playlists server-side — no loading state needed here, layout streams
  const playlists = getAllPlaylists().map((p) => ({
    ...p,
    songCount: getSongsForPlaylist(p.id).length,
  }));

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center gap-3 shrink-0">
        <Music2 className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold tracking-tight">YTDLPSync</h1>
        <span className="text-muted-foreground text-sm ml-1">SoundCloud downloader</span>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar playlists={playlists} />
        <main className="flex-1 overflow-hidden flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
