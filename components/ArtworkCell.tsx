import Image from "next/image";
import { Image as ImageIcon } from "lucide-react";

interface Props {
  playlistId: string;
  songId: number;
  hasArtwork: boolean;
  exists: boolean;
}

export function ArtworkCell({ playlistId, songId, hasArtwork, exists }: Props) {
  if (!exists) {
    return (
      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-muted-foreground shrink-0">
        <ImageIcon className="w-4 h-4" />
      </div>
    );
  }

  if (hasArtwork) {
    return (
      <div className="w-8 h-8 rounded shrink-0 relative overflow-hidden bg-muted">
        <Image
          src={`/api/playlists/${playlistId}/songs/${songId}/artwork`}
          alt="Artwork"
          fill
          className="object-cover"
          unoptimized
        />
      </div>
    );
  }

  return (
    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-muted-foreground shrink-0">
      <ImageIcon className="w-4 h-4" />
    </div>
  );
}
