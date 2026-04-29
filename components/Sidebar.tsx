"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Download,
  Music2,
  CheckCircle2,
  XCircle,
  Loader2,
  ListMusic,
  Trash2,
} from "lucide-react";
import type { Playlist } from "@/lib/db";

// ─── types ────────────────────────────────────────────────────────────────────

// Extend with optional songCount for sidebar display
type PlaylistWithCount = Playlist & { songCount?: number };

type LogLine = { text: string; key: number };
type Status = "idle" | "running" | "done" | "error";

interface DownloadRun {
  id: string;
  url: string;
  playlistId: string | null;
  status: Status;
  logs: LogLine[];
  newSongs: string[];
}

let _k = 0;
const nextKey = () => ++_k;

// ─── component ────────────────────────────────────────────────────────────────

interface Props {
  /** Initial playlist list rendered by the server (from the layout) */
  playlists: PlaylistWithCount[];
}

export default function Sidebar({ playlists: initialPlaylists }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [runs, setRuns] = useState<DownloadRun[]>([]);
  // client-side playlist list — starts from SSR, refreshed after a download
  const [playlists, setPlaylists] =
    useState<PlaylistWithCount[]>(initialPlaylists);
  const abortRef = useRef<AbortController | null>(null);

  // Keep playlist list in sync when the server re-renders the layout
  useEffect(() => {
    setPlaylists(initialPlaylists);
  }, [initialPlaylists]);

  // ── validation ──────────────────────────────────────────────────────────

  function validateUrl(raw: string): boolean {
    try {
      const parsed = new URL(raw.trim());
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  // ── run helpers ─────────────────────────────────────────────────────────

  function updateRun(id: string, patch: Partial<DownloadRun>) {
    setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function appendLog(id: string, text: string) {
    setRuns((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, logs: [...r.logs, { text, key: nextKey() }] } : r,
      ),
    );
  }

  // ── start download ──────────────────────────────────────────────────────

  const startDownload = useCallback(async () => {
    const trimmed = url.trim();
    if (!validateUrl(trimmed)) {
      setUrlError("Please enter a valid http/https URL");
      return;
    }
    setUrlError(null);

    const runId = `run-${Date.now()}`;
    setRuns((prev) => [
      {
        id: runId,
        url: trimmed,
        playlistId: null,
        status: "running",
        logs: [],
        newSongs: [],
      },
      ...prev,
    ]);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        updateRun(runId, { status: "error" });
        appendLog(runId, `[error] ${err.error ?? "Unknown error"}`);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.startsWith("data: ") ? part.slice(6) : part;
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === "meta") {
              updateRun(runId, { playlistId: msg.playlistId });
            } else if (msg.type === "log") {
              appendLog(runId, msg.line);
            } else if (msg.type === "done") {
              updateRun(runId, {
                status: msg.code === 0 ? "done" : "error",
                newSongs: msg.newSongs ?? [],
                playlistId: msg.playlistId ?? null,
              });
              // Re-fetch playlist list so new playlist appears
              const fresh = await fetch("/api/playlists").then((r) => r.json());
              setPlaylists(fresh);
              // Navigate to the newly created playlist
              if (msg.playlistId) {
                router.push(`/playlist/${msg.playlistId}`);
              }
            }
          } catch {
            appendLog(runId, line);
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        appendLog(runId, "[cancelled]");
        updateRun(runId, { status: "error" });
      } else {
        const msg = err instanceof Error ? err.message : "Unknown error";
        appendLog(runId, `[error] ${msg}`);
        updateRun(runId, { status: "error" });
      }
    }
  }, [url, router]);

  function cancelDownload() {
    abortRef.current?.abort();
  }

  // ── render ──────────────────────────────────────────────────────────────

  const runningRun = runs.find((r) => r.status === "running");

  function statusIcon(status: Status) {
    switch (status) {
      case "running":
        return (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
        );
      case "done":
        return <CheckCircle2 className="h-3.5 w-3.5 text-foreground shrink-0" />;
      case "error":
        return <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
      default:
        return null;
    }
  }

  return (
    <aside className="w-72 border-r border-border flex flex-col shrink-0 h-full bg-background">
      {/* URL input */}
      <div className="p-3 border-b border-border shrink-0">
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (urlError) setUrlError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") startDownload();
            }}
            placeholder="soundcloud.com/…"
            className="bg-background border-input text-foreground placeholder:text-muted-foreground text-xs h-8"
          />
          {runningRun ? (
            <Button
              size="icon"
              variant="destructive"
              className="h-8 w-8 shrink-0"
              onClick={cancelDownload}
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              size="icon"
              disabled={!url.trim()}
              onClick={startDownload}
              className="h-8 w-8 shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        {urlError && (
          <p className="text-destructive text-[10px] mt-1 flex items-center gap-1">
            <XCircle className="h-3 w-3" /> {urlError}
          </p>
        )}
      </div>

      <ScrollArea className="flex-1">
        {/* Recent runs */}
        {runs.length > 0 && (
          <>
            <div className="px-3 pt-3 pb-1 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Recent runs
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-destructive"
                onClick={() => setRuns([])}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <ul>
              {runs.map((run) => {
                const isActive =
                  run.playlistId !== null &&
                  pathname === `/playlist/${run.playlistId}`;
                return (
                  <li key={run.id}>
                    <div
                      className={`px-3 py-2 border-l-2 ${
                        isActive
                          ? "bg-accent border-primary"
                          : "border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {statusIcon(run.status)}
                        <span className="text-xs text-foreground truncate">
                          {run.url.replace(/^https?:\/\//, "")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 ml-5">
                        {run.newSongs.length > 0 && (
                          <span className="text-[10px] text-primary">
                            +{run.newSongs.length} new
                          </span>
                        )}
                        {run.status === "done" && run.playlistId && (
                          <Link
                            href={`/playlist/${run.playlistId}`}
                            className="text-[10px] text-primary hover:text-primary/80"
                          >
                            View →
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Separator className="mt-2 bg-border" />
          </>
        )}

        {/* Saved playlists */}
        <div className="px-3 pt-3 pb-1">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
            <ListMusic className="h-3 w-3" /> Playlists
          </span>
        </div>
        {playlists.length === 0 ? (
          <p className="text-muted-foreground text-xs px-3 pb-4">No playlists yet</p>
        ) : (
          <ul className="pb-3">
            {playlists.map((pl) => {
              const isActive = pathname === `/playlist/${pl.id}`;
              const label = pl.name ?? pl.url.replace(/^https?:\/\//, "");
              return (
                <li key={pl.id}>
                  <Link
                    href={`/playlist/${pl.id}`}
                    className={`block px-3 py-2.5 hover:bg-accent transition-colors border-l-2 ${
                      isActive
                        ? "bg-accent border-primary"
                        : "border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Music2 className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                      <span className="text-xs text-foreground truncate flex-1">
                        {label}
                      </span>
                      {(pl.songCount ?? 0) > 0 && (
                        <Badge
                          variant="secondary"
                          className="h-4 px-1 text-[9px] shrink-0"
                        >
                          {pl.songCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono truncate ml-5">
                      {pl.url.replace(/^https?:\/\//, "")}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </aside>
  );
}
