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
  if (line.includes("[error]") || line.includes("ERROR")) return "text-red-400";
  if (line.includes("[download]")) return "text-blue-400";
  if (line.includes("[ExtractAudio]") || line.includes("[ffmpeg]"))
    return "text-purple-400";
  if (line.includes("[Metadata]") || line.includes("[EmbedThumbnail]"))
    return "text-yellow-400";
  if (line.startsWith("[cancelled]")) return "text-orange-400";
  return "text-zinc-300";
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
      <span className="h-8 w-8 shrink-0 rounded bg-zinc-800/50 flex items-center justify-center">
        <XCircle className="h-4 w-4 text-zinc-700" />
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
    <span className="h-8 w-8 shrink-0 rounded bg-zinc-800 flex items-center justify-center">
      <Music2 className="h-4 w-4 text-zinc-600" />
    </span>
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
      <div className="px-6 pt-5 pb-4 border-b border-zinc-800 shrink-0">
        {/* Name row */}
        <div className="flex items-center gap-2 mb-2">
          <Music2 className="h-5 w-5 text-orange-400 shrink-0" />
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
                className="h-8 text-sm bg-zinc-900 border-zinc-700"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-green-400"
                onClick={saveName}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-zinc-500"
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
                    className="h-6 w-6 text-zinc-500 hover:text-zinc-300 shrink-0"
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
                className="h-7 w-7 text-zinc-600 hover:text-red-400 shrink-0"
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
            <Link2 className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
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
                className="h-7 text-xs font-mono bg-zinc-900 border-zinc-700"
              />
              {urlErr && (
                <p className="text-red-400 text-xs mt-0.5">{urlErr}</p>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-green-400 shrink-0"
              onClick={saveUrl}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-zinc-500 shrink-0"
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
            <Link2 className="h-3 w-3 text-zinc-600 shrink-0" />
            <span className="text-xs font-mono text-zinc-500 truncate flex-1">
              {playlist.url}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
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
            <Button
              size="sm"
              onClick={startRefresh}
              className="h-8 bg-orange-500 hover:bg-orange-600 text-white"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh
            </Button>
          )}

          {/* Download all ZIP */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadZip(false)}
            className="h-8 border-zinc-700 hover:bg-zinc-800"
          >
            <Package className="h-3.5 w-3.5 mr-1.5" /> Download ZIP
          </Button>

          {/* Download new-only ZIP */}
          {newSongs.length > 0 && refreshStartAt && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadZip(true)}
              className="h-8 border-green-800 text-green-400 hover:bg-zinc-800"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> New songs ZIP
              <Badge className="ml-1.5 h-4 px-1 text-[10px]">
                {newSongs.length}
              </Badge>
            </Button>
          )}

          {/* Status badge */}
          {refreshStatus === "running" && (
            <span className="flex items-center gap-1 text-xs text-blue-400">
              <Loader2 className="h-3 w-3 animate-spin" /> Syncing…
            </span>
          )}
          {refreshStatus === "done" && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle2 className="h-3 w-3" />
              {newSongs.length > 0
                ? `${newSongs.length} new song${newSongs.length !== 1 ? "s" : ""}`
                : "Up to date"}
            </span>
          )}
          {refreshStatus === "error" && (
            <span className="flex items-center gap-1 text-xs text-red-400">
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
        <TabsList className="mx-6 mt-3 mb-0 self-start bg-zinc-900 border border-zinc-800">
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
                <span className="ml-1 h-1.5 w-1.5 rounded-full bg-orange-400 inline-block" />
              )}
          </TabsTrigger>
        </TabsList>

        {/* Songs tab */}
        <TabsContent value="songs" className="flex-1 min-h-0 mt-0 mx-0">
          {songsLoading ? (
            <div className="flex items-center justify-center h-40 text-zinc-600 text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : songs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-zinc-600 gap-2">
              <Music2 className="h-8 w-8 opacity-30" />
              <p className="text-sm">No songs downloaded yet</p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-zinc-950 z-10">
                  <tr className="border-b border-zinc-800 text-zinc-500">
                    <th className="text-left px-6 py-2 font-medium w-8">#</th>
                    <th className="text-left px-2 py-2 font-medium">
                      Title / File
                    </th>
                    <th className="text-left px-2 py-2 font-medium hidden md:table-cell">
                      Artist
                    </th>
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
                        className={`border-b border-zinc-800/50 transition-colors group/row ${
                          isErrored
                            ? "bg-red-950/40 hover:bg-red-950/60"
                            : !song.exists
                              ? "opacity-40 hover:bg-zinc-900/60"
                              : "hover:bg-zinc-900/60"
                        }`}
                      >
                        <td className="px-6 py-1.5 text-zinc-600 tabular-nums">
                          {i + 1}
                        </td>
                        <td className="px-2 py-1.5 max-w-0">
                          <div className="flex items-center gap-2">
                            {/* Artwork + optional error triangle */}
                            <div className="relative shrink-0">
                              <SongArtwork
                                playlistId={playlist.id}
                                song={song}
                              />
                              {isErrored && (
                                <span className="absolute -top-1 -right-1">
                                  <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                {song.title ? (
                                  <p className="truncate font-medium text-zinc-200">
                                    {song.title}
                                  </p>
                                ) : (
                                  <p className="truncate text-zinc-400 font-mono">
                                    {song.filename}
                                  </p>
                                )}
                                {isErrored && (
                                  <Badge className="shrink-0 h-4 px-1 text-[10px] bg-red-900/60 text-red-400 border-red-800">
                                    &lt; 30s
                                  </Badge>
                                )}
                              </div>
                              {song.title && (
                                <p className="truncate text-zinc-600 font-mono text-[10px]">
                                  {song.filename}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-zinc-400 truncate max-w-[140px] hidden md:table-cell">
                          {song.artist ?? (
                            <span className="text-zinc-700">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right text-zinc-500 tabular-nums hidden lg:table-cell">
                          {fmtDuration(song.duration)}
                        </td>
                        <td className="px-4 py-1.5 text-right text-zinc-600 tabular-nums hidden lg:table-cell">
                          {fmtBytes(song.size)}
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-zinc-500 hover:text-zinc-200"
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
                                  className="h-6 w-6 text-zinc-500 hover:text-red-400"
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
                <span className="text-zinc-600">
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
                      <Separator className="my-2 bg-zinc-800" />
                      <p className="text-green-400 font-sans font-medium text-[11px] pb-1 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> {newSongs.length} new
                        song{newSongs.length !== 1 ? "s" : ""} downloaded
                      </p>
                      {newSongs.map((s, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 text-zinc-300 leading-5"
                        >
                          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
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
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-50 max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete playlist?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            This removes{" "}
            <span className="font-semibold text-zinc-200">{displayName}</span>{" "}
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
