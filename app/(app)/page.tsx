import { getAllPlaylists } from "@/lib/db";
import Link from "next/link";
import { Music2, ListMusic } from "lucide-react";

export default async function HomePage() {
  const playlists = getAllPlaylists();
  const latest = playlists[0] ?? null;

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center text-muted-foreground max-w-xs">
        <Music2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
        <p className="text-sm font-medium text-muted-foreground">
          Paste a SoundCloud URL in the sidebar to start downloading
        </p>
        <p className="text-xs mt-1 text-muted-foreground/70">
          Re-syncing a URL only fetches new tracks. Select a playlist to browse
          songs, refresh, and download ZIPs.
        </p>
        {latest && (
          <Link
            href={`/playlist/${latest.id}`}
            className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-md border border-border text-muted-foreground text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <ListMusic className="h-3.5 w-3.5" />
            Open latest playlist
          </Link>
        )}
      </div>
    </div>
  );
}
