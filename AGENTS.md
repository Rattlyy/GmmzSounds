<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
- **Database Rules:** Use `bun:sqlite` directly, initialized via `lib/db.ts` utilizing `db.exec`, `db.query`. DO NOT use `better-sqlite3`.
- **UI Architecture:** Use Tailwind CSS v4, Shadcn UI. DO NOT edit `components/ui/*` manually, run `bunx shadcn@latest add <name>` instead.
