# Zvelclaw Legacy Vercel/Eve UI Archive

This archive records the recovered legacy Vercel/Eve workspace UI without placing executable TypeScript in the application source tree.

- Original scaffold commit: `cec5211ba963dd8e049aa70596b9040a5d5cf178`
- Original UI source: `app/_components/agent-chat.tsx`
- Original UI blob: `9358981dbc2f07588c975193aff7ab0128532111`
- Original agent source: `agent/agent.ts`
- Legacy source remains available in Git history and at the original source path above.

The previous `archive/agent-ide.tsx` file was a raw-string snapshot and was never part of the application. It was causing TypeScript parsing errors because `tsconfig.json` includes `.tsx` files. This Markdown archive is intentionally non-executable.