"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Music2,
  RefreshCw,
  Pencil,
  Check,
  X,
  Terminal,
  Loader2,
  CheckCircle2,
  XCircle,
  Package,
  Clock,
  HardDrive,
  FileAudio,
  Sparkles,
  Link2,
  Trash2,
  ArrowDownToLine,
  AlertTriangle,
} from "lucide-react";
import type { Playlist } from "@/lib/db";
import type { EnrichedSong } from "@/app/(app)/playlist/[id]/page";

// ─── types ────────────────────────────────────────────────────────────────────

type LogLine = { text: string; key: number };
type RefreshStatus = "idle" | "running" | "done" | "error";

let _k = 0;
const nextKey = () => ++_k;

// ─── helpers ──────────────────────────────────────────────────────────────────

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

function logClass(line: string): string {
  if (line.includes("[error]") || line.includes("ERROR")) return "text-destructive";
  if (line.includes("[download]")) return "text-primary";
  if (line.includes("[ExtractAudio]") || line.includes("[ffmpeg]"))
    return "text-muted-foreground";
  if (line.includes("[Metadata]") || line.includes("[EmbedThumbnail]"))
    return "text-accent-foreground";
  if (line.startsWith("[cancelled]")) return "text-muted-foreground";
  return "text-foreground";
}

// ─── SongArtwork ─────────────────────────────────────────────────────────────

function SongArtwork({
  playlistId,
  song,
}: {
  playlistId: string;
  song: EnrichedSong;
}) {
  const [errored, setErrored] = useState(false);

  if (!song.exists) {
    return (
      <span className="h-8 w-8 shrink-0 rounded bg-muted flex items-center justify-center">
        <XCircle className="h-4 w-4 text-muted-foreground" />
      </span>
    );
  }

  if (song.hasArtwork && !errored) {
    const src = `/api/playlists/${playlistId}/artwork?songId=${song.id}`;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setErrored(true)}
        className="h-8 w-8 shrink-0 rounded object-cover"
      />
    );
  }

  return (
    <span className="h-8 w-8 shrink-0 rounded bg-muted flex items-center justify-center">
      <Music2 className="h-4 w-4 text-muted-foreground" />
    </span>
  );
}

function SongWaveformLoader({
  playlistId,
  songId,
  waveform,
}: {
  playlistId: string;
  songId: number;
  waveform: string | null;
}) {
  const [loading, setLoading] = React.useState(!waveform);
  const [displayWaveform, setDisplayWaveform] = React.useState(waveform);

  React.useEffect(() => {
    if (displayWaveform || !loading) return;

    const generate = async () => {
      try {
        const res = await fetch(
          `/api/playlists/${playlistId}/songs/${songId}/analyze`,
          { method: "POST" }
        );
        if (res.ok) {
          const data = await res.json();
          setDisplayWaveform(JSON.stringify(data.waveform));
        }
      } catch (err) {
        console.error("Waveform generation error:", err);
      } finally {
        setLoading(false);
      }
    };

    generate();
  }, [playlistId, songId, loading, displayWaveform]);

  if (loading) {
    return <span className="h-6 w-full rounded bg-muted animate-pulse" />;
  }

  return <SongWaveform waveform={displayWaveform} />;
}

function SongWaveform({ waveform }: { waveform: string | null }) {
  if (!waveform) {
    return <span className="h-6 w-full rounded bg-muted/70" />;
  }

  let bins: { low: number; mid: number; high: number }[];
  try {
    bins = JSON.parse(waveform) as { low: number; mid: number; high: number }[];
  } catch {
    return <span className="h-6 w-full rounded bg-muted/70" />;
  }

  const width = Math.min(Math.max(bins.length, 40), 120);
  const slice = bins.slice(0, width);

  return (
    <svg
      viewBox={`0 -1 ${slice.length} 2`}
      preserveAspectRatio="none"
      aria-hidden
      className="h-6 w-full overflow-visible"
      style={{ display: "block" }}
    >
      {slice.map((bin, i) => {
        const totalH = Math.max(bin.low, bin.mid, bin.high);
        if (totalH < 0.005) return null;

        const lowH = Math.max(bin.low * 0.6, 0.02); // Ensure minimum visibility
        const midH = Math.max(bin.mid * 0.8, 0.02);
        const highH = Math.max(bin.high, 0.02);
        const gap = slice.length > 80 ? 0.15 : 0.2;
        const bw = 1 - gap;
        const x = i + gap / 2;

        return (
          <g key={i}>
            {/* Upper half */}
            <rect x={x} y={-lowH} width={bw} height={lowH} fill="#0055e2" opacity="1" />
            <rect x={x} y={-midH} width={bw} height={midH} fill="#f2aa3c" opacity="1" />
            <rect x={x} y={-highH} width={bw} height={highH} fill="#ffffff" opacity="1" />
            {/* Lower half (mirror) */}
            <rect x={x} y={0} width={bw} height={lowH} fill="#0055e2" opacity="0.6" />
            <rect x={x} y={0} width={bw} height={midH} fill="#f2aa3c" opacity="0.6" />
            <rect x={x} y={0} width={bw} height={highH} fill="#ffffff" opacity="0.6" />
          </g>
        );
      })}
    </svg>
  );
}


// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  playlist: Playlist;
  initialSongs: EnrichedSong[];
  onUpdated?: (p: Playlist) => void;
  onDeleted?: (id: string) => void;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function PlaylistShell({
  playlist: initialPlaylist,
  initialSongs,
  onUpdated,
  onDeleted,
}: Props) {
  const router = useRouter();

  // local playlist state (name/url edits update this)
  const [playlist, setPlaylist] = useState<Playlist>(initialPlaylist);

  // songs
  const [songs, setSongs] = useState<EnrichedSong[]>(initialSongs);
  const [songsLoading, setSongsLoading] = useState(false);

  // inline edit name
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(initialPlaylist.name ?? "");

  // inline edit url
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlVal, setUrlVal] = useState(initialPlaylist.url);
  const [urlErr, setUrlErr] = useState<string | null>(null);

  // refresh
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>("idle");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [newSongs, setNewSongs] = useState<string[]>([]);
  const [refreshStartAt, setRefreshStartAt] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);

  // reset waveforms
  const [resettingWaveforms, setResettingWaveforms] = useState(false);

  // active tab
  const [tab, setTab] = useState<"songs" | "logs">("songs");

  // sync external changes when playlist prop changes identity
  useEffect(() => {
    setPlaylist(initialPlaylist);
    setNameVal(initialPlaylist.name ?? "");
    setUrlVal(initialPlaylist.url);
  }, [initialPlaylist.id, initialPlaylist.name, initialPlaylist.url]); // eslint-disable-line react-hooks/exhaustive-deps

  // auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // ── reload songs from API ──────────────────────────────────────────────────

  const reloadSongs = useCallback(async () => {
    setSongsLoading(true);
    try {
      const res = await fetch(`/api/playlists/${playlist.id}/songs`);
      if (res.ok) setSongs(await res.json());
    } finally {
      setSongsLoading(false);
    }
  }, [playlist.id]);

  // ── name edit ──────────────────────────────────────────────────────────────

  async function saveName() {
    const trimmed = nameVal.trim() || null;
    const res = await fetch(`/api/playlists/${playlist.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) {
      const updated = await res.json();
      const next = { ...playlist, name: updated.name };
      setPlaylist(next);
      onUpdated?.(next);
    }
    setEditingName(false);
  }

  // ── url edit ───────────────────────────────────────────────────────────────

  async function saveUrl() {
    setUrlErr(null);
    try {
      const parsed = new URL(urlVal.trim());
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setUrlErr("Must be http/https");
        return;
      }
    } catch {
      setUrlErr("Invalid URL");
      return;
    }
    const res = await fetch(`/api/playlists/${playlist.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: urlVal.trim() }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      setUrlErr(e.error ?? "Failed");
      return;
    }
    const updated = await res.json();
    const next = { ...playlist, url: updated.url };
    setPlaylist(next);
    onUpdated?.(next);
    setEditingUrl(false);
  }

  // ── refresh ────────────────────────────────────────────────────────────────

  const startRefresh = useCallback(async () => {
    setRefreshStatus("running");
    setLogs([]);
    setNewSongs([]);
    setRefreshStartAt(null);
    setTab("logs");

    const abort = new AbortController();
    abortRef.current = abort;

    function appendLog(text: string) {
      setLogs((prev) => [...prev, { text, key: nextKey() }]);
    }

    try {
      const res = await fetch(`/api/playlists/${playlist.id}/refresh`, {
        method: "POST",
        signal: abort.signal,
      });

      if (!res.ok) {
        appendLog("[error] Refresh request failed");
        setRefreshStatus("error");
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.startsWith("data: ") ? part.slice(6) : part;
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === "meta") {
              setRefreshStartAt(msg.refreshStartAt ?? null);
            } else if (msg.type === "log") {
              appendLog(msg.line);
            } else if (msg.type === "done") {
              setRefreshStatus(msg.code === 0 ? "done" : "error");
              setNewSongs(msg.newSongs ?? []);
              await reloadSongs();
            }
          } catch {
            if (line.trim()) appendLog(line);
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setLogs((p) => [...p, { text: "[cancelled]", key: nextKey() }]);
        setRefreshStatus("error");
      } else {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setLogs((p) => [...p, { text: `[error] ${msg}`, key: nextKey() }]);
        setRefreshStatus("error");
      }
    }
  }, [playlist.id, reloadSongs]);

  function cancelRefresh() {
    abortRef.current?.abort();
  }

  // ── zip download ───────────────────────────────────────────────────────────

  function downloadZip(newOnly = false) {
    const base = `/api/playlists/${playlist.id}/zip`;
    const url =
      newOnly && refreshStartAt ? `${base}?since=${refreshStartAt}` : base;
    window.open(url, "_blank");
  }

  // ── delete playlist ────────────────────────────────────────────────────────

  async function confirmDelete() {
    await fetch(`/api/playlists/${playlist.id}`, { method: "DELETE" });
    setDeleteOpen(false);
    if (onDeleted) {
      onDeleted(playlist.id);
    } else {
      router.push("/");
    }
  }

  // ── reset waveforms ───────────────────────────────────────────────────────

  async function resetWaveforms() {
    setResettingWaveforms(true);
    try {
      const res = await fetch(`/api/playlists/${playlist.id}/waveforms/reset`, {
        method: "POST",
      });
      if (res.ok) {
        await reloadSongs();
      }
    } catch (err) {
      console.error("Failed to reset waveforms:", err);
    } finally {
      setResettingWaveforms(false);
    }
  }

  // ── song actions ───────────────────────────────────────────────────────────

  function downloadSong(song: EnrichedSong) {
    window.location.href = `/api/playlists/${playlist.id}/songs/${song.id}`;
  }

  async function deleteSong(song: EnrichedSong) {
    await fetch(`/api/playlists/${playlist.id}/songs/${song.id}`, {
      method: "DELETE",
    });
    await reloadSongs();
  }

  // ─── render ─────────────────────────────────────────────────────────────────

  const displayName = playlist.name ?? playlist.url.replace(/^https?:\/\//, "");

  return (
    <div className="flex flex-col h-full gap-0">
      {/* ── Header ── */}
      <div className="px-6 pt-5 pb-4 border-b border-border shrink-0">
        {/* Name row */}
        <div className="flex items-center gap-2 mb-2">
          <Music2 className="h-5 w-5 text-primary shrink-0" />
          {editingName ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                autoFocus
                value={nameVal}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNameVal(e.target.value)
                }
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") {
                    setEditingName(false);
                    setNameVal(playlist.name ?? "");
                  }
                }}
                placeholder="Playlist name…"
                className="h-8 text-sm bg-background border-input"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-foreground"
                onClick={saveName}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground"
                onClick={() => {
                  setEditingName(false);
                  setNameVal(playlist.name ?? "");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h2 className="text-base font-semibold truncate">
                {displayName}
              </h2>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => setEditingName(true)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Rename</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Delete playlist */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete playlist</TooltipContent>
          </Tooltip>
        </div>

        {/* URL row */}
        {editingUrl ? (
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <Input
                autoFocus
                value={urlVal}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setUrlVal(e.target.value);
                  setUrlErr(null);
                }}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter") saveUrl();
                  if (e.key === "Escape") {
                    setEditingUrl(false);
                    setUrlVal(playlist.url);
                    setUrlErr(null);
                  }
                }}
                className="h-7 text-xs font-mono bg-background border-input"
              />
              {urlErr && (
                <p className="text-destructive text-xs mt-0.5">{urlErr}</p>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-foreground shrink-0"
              onClick={saveUrl}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground shrink-0"
              onClick={() => {
                setEditingUrl(false);
                setUrlVal(playlist.url);
                setUrlErr(null);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 mb-3 group">
            <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs font-mono text-muted-foreground truncate flex-1">
              {playlist.url}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={() => setEditingUrl(true)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Refresh / Cancel */}
          {refreshStatus === "running" ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={cancelRefresh}
              className="h-8"
            >
              <XCircle className="h-3.5 w-3.5 mr-1.5" /> Cancel
            </Button>
          ) : (
            <Button size="sm" onClick={startRefresh} className="h-8">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </Button>
          )}

          {/* Download all ZIP */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadZip(false)}
            className="h-8"
          >
            <Package className="h-3.5 w-3.5 mr-1.5" /> Download ZIP
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={resetWaveforms}
            disabled={resettingWaveforms}
            className="h-8"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            {resettingWaveforms ? "Resetting…" : "Reset Waveforms"}
          </Button>

          {/* Download new-only ZIP */}
          {newSongs.length > 0 && refreshStartAt && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadZip(true)}
              className="h-8"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> New songs ZIP
              <Badge className="ml-1.5 h-4 px-1 text-[10px]">
                {newSongs.length}
              </Badge>
            </Button>
          )}

          {/* Status badge */}
          {refreshStatus === "running" && (
            <span className="flex items-center gap-1 text-xs text-primary">
              <Loader2 className="h-3 w-3 animate-spin" /> Syncing…
            </span>
          )}
          {refreshStatus === "done" && (
            <span className="flex items-center gap-1 text-xs text-foreground">
              <CheckCircle2 className="h-3 w-3" />
              {newSongs.length > 0
                ? `${newSongs.length} new song${newSongs.length !== 1 ? "s" : ""}`
                : "Up to date"}
            </span>
          )}
          {refreshStatus === "error" && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <XCircle className="h-3 w-3" /> Error
            </span>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs
        value={tab}
        onValueChange={(v: string) => setTab(v as "songs" | "logs")}
        className="flex flex-col flex-1 min-h-0"
      >
        <TabsList className="mx-6 mt-3 mb-0 self-start bg-muted border border-border">
          <TabsTrigger value="songs" className="text-xs gap-1.5">
            <FileAudio className="h-3.5 w-3.5" />
            Songs
            {songs.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {songs.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs" className="text-xs gap-1.5">
            <Terminal className="h-3.5 w-3.5" />
            Logs
            {(refreshStatus === "running" ||
              refreshStatus === "done" ||
              refreshStatus === "error") &&
              logs.length > 0 && (
                <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary inline-block" />
              )}
          </TabsTrigger>
        </TabsList>

        {/* Songs tab */}
        <TabsContent value="songs" className="flex-1 min-h-0 mt-0 mx-0">
          {songsLoading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : songs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
              <Music2 className="h-8 w-8 opacity-30" />
              <p className="text-sm">No songs downloaded yet</p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background z-10">
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left px-6 py-2 font-medium w-8">#</th>
                    <th className="text-left px-2 py-2 font-medium">
                      Title / File
                    </th>
                    <th className="text-left px-2 py-2 font-medium hidden md:table-cell">
                      Artist
                    </th>
                    <th className="px-2 py-2 hidden lg:table-cell" />
                    <th className="text-right px-2 py-2 font-medium hidden lg:table-cell">
                      <Clock className="h-3 w-3 inline mr-0.5" />
                    </th>
                    <th className="text-right px-4 py-2 font-medium hidden lg:table-cell">
                      <HardDrive className="h-3 w-3 inline mr-0.5" />
                    </th>
                    <th className="w-16 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {songs.map((song, i) => {
                    const isErrored =
                      song.duration !== null && song.duration < 30;
                    return (
                      <tr
                        key={song.id}
                        className={`border-b border-border/50 transition-colors group/row ${
                          isErrored
                            ? "bg-destructive/10 hover:bg-destructive/15"
                            : !song.exists
                              ? "opacity-40 hover:bg-accent/60"
                              : "hover:bg-accent/60"
                        }`}
                      >
                        <td className="px-6 py-1.5 text-muted-foreground tabular-nums">
                          {i + 1}
                        </td>
                        <td className="px-2 py-1.5 w-48 shrink-0">
                          <div className="flex items-center gap-2 min-w-0">
                            {/* Artwork + title */}
                            <div className="relative shrink-0">
                              <SongArtwork
                                playlistId={playlist.id}
                                song={song}
                              />
                              {isErrored && (
                                <span className="absolute -top-1 -right-1">
                                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                {song.title ? (
                                  <p className="truncate font-medium text-foreground">
                                    {song.title}
                                  </p>
                                ) : (
                                  <p className="truncate text-muted-foreground font-mono">
                                    {song.filename}
                                  </p>
                                )}
                                {isErrored && (
                                  <Badge className="shrink-0 h-4 px-1 text-[10px] bg-destructive/10 text-destructive border-destructive">
                                    &lt; 30s
                                  </Badge>
                                )}
                              </div>
                              {song.title && (
                                <p className="truncate text-muted-foreground font-mono text-[10px]">
                                  {song.filename}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[140px] hidden md:table-cell">
                          {song.artist ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 hidden lg:table-cell w-full">
                          <div className="flex items-center justify-center h-6 w-full">
                            <SongWaveformLoader
                              playlistId={playlist.id}
                              songId={song.id}
                              waveform={song.waveform}
                            />
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right text-muted-foreground tabular-nums hidden lg:table-cell">
                          {fmtDuration(song.duration)}
                        </td>
                        <td className="px-4 py-1.5 text-right text-muted-foreground tabular-nums hidden lg:table-cell">
                          {fmtBytes(song.size)}
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center justify-end gap-1 transition-opacity">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                  onClick={() => downloadSong(song)}
                                  disabled={!song.exists}
                                >
                                  <ArrowDownToLine className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Download</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  onClick={() => deleteSong(song)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete song</TooltipContent>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Logs tab */}
        <TabsContent value="logs" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full">
            <div className="px-6 py-4 font-mono text-xs space-y-0.5">
              {logs.length === 0 ? (
                <span className="text-muted-foreground">
                  No refresh run yet. Hit Refresh to sync.
                </span>
              ) : (
                <>
                  {logs.map((l) => (
                    <div
                      key={l.key}
                      className={`leading-5 ${logClass(l.text)}`}
                    >
                      {l.text}
                    </div>
                  ))}
                  {newSongs.length > 0 && (
                    <>
                      <Separator className="my-2 bg-border" />
                      <p className="text-foreground font-sans font-medium text-[11px] pb-1 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> {newSongs.length} new
                        song{newSongs.length !== 1 ? "s" : ""} downloaded
                      </p>
                      {newSongs.map((s, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 text-foreground leading-5"
                        >
                          <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                          {s}
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
              <div ref={logEndRef} />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* ── Delete confirm dialog ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-background border-border text-foreground max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete playlist?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes{" "}
            <span className="font-semibold text-foreground">{displayName}</span>{" "}
            from the database. Downloaded files on disk are{" "}
            <span className="font-semibold">not</span> deleted.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
