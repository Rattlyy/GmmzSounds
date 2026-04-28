import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getPlaylistById, getSongsForPlaylist } from "@/lib/db";
import { parseFile } from "music-metadata";
import { Skeleton } from "@/components/ui/skeleton";
import PlaylistShell from "@/components/PlaylistShell";
import path from "path";
import fs from "fs";

export interface EnrichedSong {
  id: number;
  playlist_id: string;
  filename: string;
  added_at: number;
  exists: boolean;
  size: number | null;
  title: string | null;
  artist: string | null;
  album: string | null;
  duration: number | null;
  hasArtwork: boolean;
}

function PlaylistSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Header skeleton */}
      <div className="px-6 pt-5 pb-4 border-b border-zinc-800">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3 w-64 mt-2" />
      </div>

      {/* Tab bar skeleton */}
      <div className="mx-6 mt-3 flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>

      {/* List skeleton */}
      <div className="mt-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-6 py-2">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function PlaylistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const playlist = getPlaylistById(id);
  if (!playlist) notFound();

  const rawSongs = getSongsForPlaylist(id);

  const songs: EnrichedSong[] = await Promise.all(
    rawSongs.map(async (song) => {
      const filePath = path.join(playlist.folder, song.filename);

      let exists = false;
      let size: number | null = null;
      let title: string | null = null;
      let artist: string | null = null;
      let album: string | null = null;
      let duration: number | null = null;
      let hasArtwork = false;

      try {
        const stat = fs.statSync(filePath);
        size = stat.size;
        exists = true;
      } catch {
        // file missing
      }

      if (exists) {
        try {
          const meta = await parseFile(filePath, {
            duration: true,
            skipCovers: false,
          });
          title = meta.common.title ?? null;
          artist =
            meta.common.artist ??
            (meta.common.artists ? meta.common.artists[0] : null) ??
            null;
          album = meta.common.album ?? null;
          duration = meta.format.duration ?? null;
          hasArtwork = (meta.common.picture?.length ?? 0) > 0;
        } catch {
          // metadata unreadable – still return filename
        }
      }

      return {
        ...song,
        exists,
        size,
        title,
        artist,
        album,
        duration,
        hasArtwork,
      };
    }),
  );

  return (
    <Suspense fallback={<PlaylistSkeleton />}>
      <PlaylistShell playlist={playlist} initialSongs={songs} />
    </Suspense>
  );
}
