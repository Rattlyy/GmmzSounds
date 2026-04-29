"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Search, ArrowDownAZ, ArrowUpZA, Calendar, Hash } from "lucide-react";
import { Input } from "@/components/ui/input";

export type SortField = "index" | "title" | "size" | "downloaded_at" | "artist" | "bpm" | "duration";
export type SortDir = "asc" | "desc";

interface Props {
  q: string;
  sort: SortField;
  dir: SortDir;
}

export function SongsToolbar({ q, sort, dir }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (term) params.set("q", term);
    else params.delete("q");
    router.push(`${pathname}?${params.toString()}`);
  };

  const setSort = (field: SortField) => {
    const params = new URLSearchParams(searchParams.toString());
    let nextDir: SortDir = "asc";
    if (sort === field && dir === "asc") nextDir = "desc";
    params.set("sort", field);
    params.set("dir", nextDir);
    router.push(`${pathname}?${params.toString()}`);
  };

  const btnClasses = (field: SortField) =>
    `flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-colors ${
      sort === field
        ? "bg-zinc-800 text-zinc-200 shadow-sm"
        : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
    }`;

  const renderIcon = (field: SortField) => {
    if (sort !== field) {
      if (field === "index") return <Hash className="w-3.5 h-3.5" />;
      if (field === "title") return <ArrowDownAZ className="w-3.5 h-3.5" />;
      if (field === "downloaded_at") return <Calendar className="w-3.5 h-3.5" />;
      return null;
    }
    return dir === "asc" ? <ArrowDownAZ className="w-3.5 h-3.5" /> : <ArrowUpZA className="w-3.5 h-3.5" />;
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2 border-b border-zinc-800 p-4 shrink-0 bg-zinc-950 items-center justify-between sticky top-0 z-20">
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-2.5 top-2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Filter songs..."
          className="pl-9 h-8 bg-zinc-900 border-zinc-800 text-sm focus-visible:ring-zinc-700"
          value={q}
          onChange={handleSearch}
        />
      </div>

      <div className="flex gap-1.5 shrink-0 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 hide-scroll">
        <button onClick={() => setSort("index")} className={btnClasses("index")}>
          {renderIcon("index")}
          Order
        </button>
        <button onClick={() => setSort("title")} className={btnClasses("title")}>
          {renderIcon("title")}
          Title
        </button>
        <button onClick={() => setSort("downloaded_at")} className={btnClasses("downloaded_at")}>
          {renderIcon("downloaded_at")}
          Recent
        </button>
      </div>
    </div>
  );
}
