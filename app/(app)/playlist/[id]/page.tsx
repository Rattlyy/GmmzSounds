import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getPlaylistById, getSongsForPlaylist } from "@/lib/db";
import type { Song } from "@/lib/db";
import { parseFile } from "music-metadata";
import { Skeleton } from "@/components/ui/skeleton";
import PlaylistShell from "@/components/PlaylistShell";
import { ArtworkCell } from "@/components/ArtworkCell";
import { SongActions } from "@/components/SongActions";
import { SongsToolbar } from "@/components/SongsToolbar";
import type { SortField, SortDir } from "@/components/SongsToolbar";
import { Badge } from "@/components/ui/badge";
import { Clock, HardDrive, AlertTriangle } from "lucide-react";
import path from "path";
import fs from "fs";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnrichedSong {
  id: number;
  playlist_id: string;
  filename: string;
  added_at: number;
  bpm: number | null;
  waveform: string | null;
  exists: boolean;
  size: number | null;
  title: string | null;
  artist: string | null;
  album: string | null;
  duration: number | null;
  hasArtwork: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(sec: number | null): string {
  if (sec == null) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fmtBytes(b: number | null): string {
  if (b == null) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 ** 2).toFixed(1)} MB`;
}

async function enrichSong(song: Song, folder: string): Promise<EnrichedSong> {
  const filePath = path.join(folder, song.filename);

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
  } catch {}

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
    } catch {}
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
    bpm: song.bpm ?? null,
    waveform: song.waveform ?? null,
  };
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function BpmWaveformSkeleton() {
  return (
    <>
      <td className="py-0 px-2 w-full hidden lg:table-cell">
        <Skeleton className="h-7 w-full" />
      </td>
      <td className="px-3 py-1.5 hidden xl:table-cell">
        <Skeleton className="h-3 w-8 mx-auto" />
      </td>
    </>
  );
}

function SongRowSkeleton() {
  return (
    <tr className="border-b border-border/50">
      <td className="px-6 py-1.5"><Skeleton className="h-3 w-4" /></td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-2.5 w-24" />
          </div>
        </div>
      </td>
      <td className="px-2 py-1.5 hidden md:table-cell"><Skeleton className="h-3 w-20" /></td>
      <BpmWaveformSkeleton />
      <td className="px-2 py-1.5 hidden lg:table-cell"><Skeleton className="h-3 w-10 ml-auto" /></td>
      <td className="px-4 py-1.5 hidden lg:table-cell"><Skeleton className="h-3 w-8 ml-auto" /></td>
      <td className="px-2 py-1.5 w-16" />
    </tr>
  );
}

function SongsTableSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-2 border-b border-border/60">
        <Skeleton className="h-7 w-56" />
      </div>
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-background z-10">
          <tr className="border-b border-border text-muted-foreground">
            <th className="text-left px-6 py-2 font-medium w-8">#</th>
            <th className="text-left px-2 py-2 font-medium">Title / File</th>
            <th className="text-left px-2 py-2 font-medium hidden md:table-cell">Artist</th>
            <th className="px-2 py-2 w-full hidden lg:table-cell" />
            <th className="text-center px-3 py-2 font-medium hidden xl:table-cell">BPM</th>
            <th className="text-right px-2 py-2 font-medium hidden lg:table-cell"><Clock className="h-3 w-3 inline mr-0.5" /></th>
            <th className="text-right px-4 py-2 font-medium hidden lg:table-cell"><HardDrive className="h-3 w-3 inline mr-0.5" /></th>
            <th className="w-16 px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }).map((_, i) => (
            <SongRowSkeleton key={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── SongRow ─────────────────────────────────────────────────────────────────

async function SongRow({
  song,
  playlistId,
  folder,
  index,
}: {
  song: Song;
  playlistId: string;
  folder: string;
  index: number;
}) {
  const enriched = await enrichSong(song, folder);
  const isErrored = enriched.duration !== null && enriched.duration < 30;

  return (
    <tr
      className={`border-b border-border/50 transition-colors group/row ${
        isErrored
          ? "bg-destructive/10 hover:bg-destructive/15"
          : !enriched.exists
            ? "opacity-40 hover:bg-accent/60"
            : "hover:bg-accent/60"
      }`}
    >
      <td className="px-6 py-1.5 text-muted-foreground tabular-nums">{index + 1}</td>
      <td className="px-2 py-1.5 max-w-0">
        <div className="flex items-center gap-2">
          <div className="relative shrink-0">
            <ArtworkCell
              playlistId={playlistId}
              songId={enriched.id}
              hasArtwork={enriched.hasArtwork}
              exists={enriched.exists}
            />
            {isErrored && (
              <span className="absolute -top-1 -right-1">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {enriched.title ? (
                <p className="truncate font-medium text-foreground">
                  {enriched.title}
                </p>
              ) : (
                <p className="truncate text-muted-foreground font-mono">
                  {enriched.filename}
                </p>
              )}
              {isErrored && (
                <Badge className="shrink-0 h-4 px-1 text-[10px] bg-destructive/10 text-destructive border-destructive">
                  &lt; 30s
                </Badge>
              )}
            </div>
            {enriched.title && (
              <p className="truncate text-muted-foreground font-mono text-[10px]">
                {enriched.filename}
              </p>
            )}
          </div>
        </div>
      </td>
      <td
        className="px-2 py-1.5 text-muted-foreground truncate hidden md:table-cell"
        style={{ maxWidth: "140px" }}
      >
        {enriched.artist ?? <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-2 py-1.5 text-right text-muted-foreground tabular-nums hidden lg:table-cell">
        {fmtDuration(enriched.duration)}
      </td>
      <td className="px-4 py-1.5 text-right text-muted-foreground tabular-nums hidden lg:table-cell">
        {fmtBytes(enriched.size)}
      </td>
      <td className="px-2 py-1.5">
        <SongActions
          playlistId={playlistId}
          songId={enriched.id}
          exists={enriched.exists}
        />
      </td>
    </tr>
  );
}

// ─── SongsTable ─────────────────────────────────────────────────────────────

async function SongsTable({
  songs,
  playlistId,
  playlistFolder,
  q,
  sort,
  dir,
}: {
  songs: Song[];
  playlistId: string;
  playlistFolder: string;
  q: string;
  sort: SortField;
  dir: SortDir;
}) {
  const enriched = await Promise.all(
    songs.map((s) => enrichSong(s, playlistFolder)),
  );

  const qLower = q.toLowerCase().trim();
  let filtered: EnrichedSong[] = qLower
    ? enriched.filter((s) => {
        const haystack = [s.title ?? s.filename, s.artist ?? "", s.album ?? ""]
          .join(" ")
          .toLowerCase();
        return haystack.includes(qLower);
      })
    : enriched;

  filtered = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sort) {
      case "title": {
        const at = (a.title ?? a.filename).toLowerCase();
        const bt = (b.title ?? b.filename).toLowerCase();
        cmp = at < bt ? -1 : at > bt ? 1 : 0;
        break;
      }
      case "artist": {
        if (!a.artist && b.artist) return dir === "asc" ? 1 : -1;
        if (a.artist && !b.artist) return dir === "asc" ? -1 : 1;
        cmp =
          (a.artist ?? "").toLowerCase() < (b.artist ?? "").toLowerCase()
            ? -1
            : (a.artist ?? "").toLowerCase() > (b.artist ?? "").toLowerCase()
              ? 1
              : 0;
        break;
      }
      case "bpm": {
        const ab = a.bpm,
          bb = b.bpm;
        if (ab == null && bb == null) cmp = 0;
        else if (ab == null) return dir === "asc" ? 1 : -1;
        else if (bb == null) return dir === "asc" ? -1 : 1;
        else cmp = ab - bb;
        break;
      }
      case "duration": {
        const ad = a.duration,
          bd = b.duration;
        if (ad == null && bd == null) cmp = 0;
        else if (ad == null) return dir === "asc" ? 1 : -1;
        else if (bd == null) return dir === "asc" ? -1 : 1;
        else cmp = ad - bd;
        break;
      }
    }
    return dir === "asc" ? cmp : -cmp;
  });

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col">
        <SongsToolbar q={q} sort={sort} dir={dir} />
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
          <p className="text-sm">
            {qLower ? "No songs match your search" : "No songs downloaded yet"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <SongsToolbar q={q} sort={sort} dir={dir} />
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-background z-10">
          <tr className="border-b border-border text-muted-foreground">
            <th className="text-left px-6 py-2 font-medium w-8">#</th>
            <th className="text-left px-2 py-2 font-medium">Title / File</th>
            <th className="text-left px-2 py-2 font-medium hidden md:table-cell">Artist</th>
            <th className="px-2 py-2 w-full hidden lg:table-cell" />
            <th className="text-center px-3 py-2 font-medium hidden xl:table-cell">BPM</th>
            <th className="text-right px-2 py-2 font-medium hidden lg:table-cell"><Clock className="h-3 w-3 inline mr-0.5" /></th>
            <th className="text-right px-4 py-2 font-medium hidden lg:table-cell"><HardDrive className="h-3 w-3 inline mr-0.5" /></th>
            <th className="w-16 px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {filtered.map((song, i) => (
            <Suspense key={song.id} fallback={<SongRowSkeleton />}>
              <SongRow
                song={song}
                playlistId={playlistId}
                folder={playlistFolder}
                index={i}
              />
            </Suspense>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── PlaylistSkeleton ─────────────────────────────────────────────────────────

function PlaylistSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-3 w-64 mt-2" />
      </div>
      <div className="mx-6 mt-3 flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PlaylistPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; sort?: string; dir?: string }>;
}) {
  const { id } = await params;
  const {
    q = "",
    sort: sortRaw = "title",
    dir: dirRaw = "asc",
  } = await searchParams;

  const validSorts: SortField[] = ["title", "artist", "bpm", "duration"];
  const sort: SortField = validSorts.includes(sortRaw as SortField)
    ? (sortRaw as SortField)
    : "title";
  const dir: SortDir = dirRaw === "desc" ? "desc" : "asc";

  const playlist = getPlaylistById(id);
  if (!playlist) notFound();

  const rawSongs = getSongsForPlaylist(id);
  const initialSongs = await Promise.all(
    rawSongs.map((song) => enrichSong(song, playlist.folder)),
  );

  return (
    <Suspense fallback={<PlaylistSkeleton />}>
      <PlaylistShell
        playlist={playlist}
        initialSongs={initialSongs}
      />
    </Suspense>
  );
}
