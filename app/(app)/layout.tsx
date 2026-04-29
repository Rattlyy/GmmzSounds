import { getAllPlaylists, getSongsForPlaylist } from "@/lib/db";
import AppShell from "@/components/AppShell";

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

  return <AppShell playlists={playlists}>{children}</AppShell>;
}
