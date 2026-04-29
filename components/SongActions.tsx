"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  playlistId: string;
  songId: number;
  exists: boolean;
}

export function SongActions({ playlistId, songId, exists }: Props) {
  return (
    <div className="flex items-center gap-1 justify-end">
      <Button variant="outline" size="icon-sm">
        <a
          href={`/api/playlists/${playlistId}/songs/${songId}`}
          download
          title="Download Track"
        >
          <Download className="w-3.5 h-3.5" />
        </a>
      </Button>
    </div>
  );
}
