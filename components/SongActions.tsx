"use client";

import { Download, Play } from "lucide-react";

interface Props {
  playlistId: string;
  songId: number;
  exists: boolean;
}

export function SongActions({ playlistId, songId, exists }: Props) {
  if (!exists) {
    return <span className="text-muted-foreground italic text-[10px]">Missing</span>;
  }

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
      <a
        href={`/api/playlists/${playlistId}/songs/${songId}`}
        download
        className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-accent-foreground"
        title="Download Track"
      >
        <Download className="w-3.5 h-3.5" />
      </a>
      {/* Play logic can go here in the future if we build an in-browser player */}
      <button className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-accent-foreground cursor-pointer" title="Play">
        <Play className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
