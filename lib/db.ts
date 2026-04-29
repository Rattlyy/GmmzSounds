import { Database } from "bun:sqlite";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, "ytdlpsync.db");

let _db: Database | null = null;

export function getDb(): Database {
  if (!_db) {
    _db = new Database(DB_PATH, { create: true });
    _db.exec("PRAGMA journal_mode = WAL;");
    _db.exec("PRAGMA foreign_keys = ON;");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS playlists (
      id         TEXT PRIMARY KEY,
      url        TEXT NOT NULL UNIQUE,
      folder     TEXT NOT NULL,
      name       TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS songs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      filename    TEXT NOT NULL,
      bpm         INTEGER,
      waveform    TEXT,
      added_at    INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      UNIQUE(playlist_id, filename)
    );
  `);

  // migrate: add name column if missing (existing DBs)
  const cols = db.query("PRAGMA table_info(playlists)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "name")) {
    db.exec("ALTER TABLE playlists ADD COLUMN name TEXT");
  }
}

export interface Playlist {
  id: string;
  url: string;
  folder: string;
  name: string | null;
  created_at: number;
}

export interface Song {
  id: number;
  playlist_id: string;
  filename: string;
  added_at: number;
}

export function getOrCreatePlaylist(
  url: string,
  folder: string,
  id: string,
): Playlist {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM playlists WHERE url = ?")
    .get(url) as Playlist | undefined;
  if (existing) return existing;

  db.prepare("INSERT INTO playlists (id, url, folder) VALUES (?, ?, ?)").run(
    id,
    url,
    folder,
  );
  return db.prepare("SELECT * FROM playlists WHERE id = ?").get(id) as Playlist;
}

export function getPlaylistByUrl(url: string): Playlist | undefined {
  return getDb().prepare("SELECT * FROM playlists WHERE url = ?").get(url) as
    | Playlist
    | undefined;
}

export function getPlaylistById(id: string): Playlist | undefined {
  return getDb().prepare("SELECT * FROM playlists WHERE id = ?").get(id) as
    | Playlist
    | undefined;
}

export function getAllPlaylists(): Playlist[] {
  return getDb()
    .prepare("SELECT * FROM playlists ORDER BY created_at DESC")
    .all() as Playlist[];
}

export function updatePlaylist(
  id: string,
  patch: { name?: string | null; url?: string },
): void {
  const db = getDb();
  if (patch.name !== undefined) {
    db.prepare("UPDATE playlists SET name = ? WHERE id = ?").run(
      patch.name,
      id,
    );
  }
  if (patch.url !== undefined) {
    db.prepare("UPDATE playlists SET url = ? WHERE id = ?").run(patch.url, id);
  }
}

export function deletePlaylist(id: string): void {
  getDb().prepare("DELETE FROM playlists WHERE id = ?").run(id);
}

export function recordSong(playlistId: string, filename: string): void {
  getDb()
    .prepare(
      "INSERT OR IGNORE INTO songs (playlist_id, filename) VALUES (?, ?)",
    )
    .run(playlistId, filename);
}

export function getSongsForPlaylist(playlistId: string): Song[] {
  return getDb()
    .prepare("SELECT * FROM songs WHERE playlist_id = ? ORDER BY added_at DESC")
    .all(playlistId) as Song[];
}

export function getSongFilenames(playlistId: string): Set<string> {
  const rows = getDb()
    .prepare("SELECT filename FROM songs WHERE playlist_id = ?")
    .all(playlistId) as { filename: string }[];
  return new Set(rows.map((r) => r.filename));
}

export function deleteSong(id: number): void {
  getDb().prepare("DELETE FROM songs WHERE id = ?").run(id);
}

export function setAnalysis(songId: number, bpm: number, waveform: string) {
  const db = getDb();
  db.query("UPDATE songs SET bpm = ?, waveform = ? WHERE id = ?").run(bpm, waveform, songId);
}
