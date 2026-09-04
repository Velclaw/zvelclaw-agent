import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const DEFAULT_REPO = "Velclaw/zvelclaw-agent";
const GITHUB_API = "https://api.github.com";
const MAX_FILES = 20;
const MAX_FILE_SIZE = 500_000;
const BUILD_WORKFLOW = `name: Zvelclaw Build\n\non:\n  push:\n    branches:\n      - "feature/**"\n      - "fix/**"\n      - "chore/**"\n      - "codex/**"\n      - "zvelclaw/**"\n  workflow_dispatch:\n    inputs:\n      ref:\n        description: "Branch or commit to verify"\n        required: true\n        default: "main"\n\nconcurrency:\n  group: zvelclaw-build-\${{ github.ref }}\n  cancel-in-progress: true\n\njobs:\n  verify:\n    name: Typecheck and build\n    runs-on: ubuntu-latest\n    timeout-minutes: 15\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n        with:\n          ref: \${{ github.event.inputs.ref || github.sha }}\n      - name: Setup pnpm\n        uses: pnpm/action-setup@v4\n        with:\n          version: 10\n          run_install: false\n      - name: Setup Node\n        uses: actions/setup-node@v4\n        with:\n          node-version: 24\n          cache: pnpm\n      - name: Install dependencies\n        run: pnpm install --frozen-lockfile\n      - name: Typecheck\n        run: pnpm exec tsc --noEmit -p tsconfig.json\n      - name: Production build\n        run: pnpm build\n`;

async function requireAccess() {
  if (process.env.NODE_ENV === "development") return true;
  return Boolean(await auth.api.getSession({ headers: await headers() }));
}
function githubHeaders() { return { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) }; }
function parseRepo(value: unknown) { const repo = typeof value === "string" && value ? value : DEFAULT_REPO; if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error("Invalid repository format."); return repo; }
function validateBranch(value: unknown) { if (typeof value !== "string" || !value || value === "main" || value === "master" || !/^(feature|fix|chore|codex|zvelclaw)\/[A-Za-z0-9._/-]+$/.test(value)) throw new Error("Writes require an isolated feature/fix/chore/codex/zvelclaw branch."); return value; }
function validatePath(value: unknown) { if (typeof value !== "string" || !value || value.length > 400 || value.startsWith("/") || value.includes("..") || value.includes("\\") || value.includes("\0")) throw new Error("Unsafe file path."); return value; }
async function github(path: string, init?: RequestInit) { if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not configured."); const response = await fetch(`${GITHUB_API}${path}`, { ...init, headers: { ...githubHeaders(), ...(init?.headers ?? {}) }, cache: "no-store" }); const body = await response.json().catch(() => null); if (!response.ok) throw new Error(body?.message || `GitHub request failed (${response.status})`); return body; }

export async function POST(request: NextRequest) {
  try {
    if (!(await requireAccess())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json(); const repo = parseRepo(body?.repo); const baseRef = typeof body?.baseRef === "string" && body.baseRef ? body.baseRef : "main"; const branch = validateBranch(body?.branch); const files = Array.isArray(body?.files) ? body.files : [];
    if (files.length === 0 || files.length > MAX_FILES) return NextResponse.json({ error: `files must contain 1-${MAX_FILES} items.` }, { status: 400 });

    const branchResponse = await fetch(`${GITHUB_API}/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, { headers: githubHeaders(), cache: "no-store" });
    if (!branchResponse.ok) { const base = await github(`/repos/${repo}/git/ref/heads/${encodeURIComponent(baseRef)}`); await github(`/repos/${repo}/git/refs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha }) }); }

    const workflowResponse = await fetch(`${GITHUB_API}/repos/${repo}/contents/.github/workflows/zvelclaw-build.yml?ref=${encodeURIComponent(branch)}`, { headers: githubHeaders(), cache: "no-store" });
    if (!workflowResponse.ok) await github(`/repos/${repo}/contents/.github/workflows/zvelclaw-build.yml`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "ci(ide): install Zvelclaw build verification", content: Buffer.from(BUILD_WORKFLOW, "utf8").toString("base64"), branch }) });

    const results: Array<{ path: string; action: string; commitSha: string }> = [];
    for (const item of files) {
      const path = validatePath(item?.path); const content = typeof item?.content === "string" ? item.content : ""; const action = item?.action === "create" ? "create" : "update";
      if (Buffer.byteLength(content, "utf8") > MAX_FILE_SIZE) throw new Error(`File is too large: ${path}`);
      const existingResponse = await fetch(`${GITHUB_API}/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`, { headers: githubHeaders(), cache: "no-store" });
      const existing = await existingResponse.json().catch(() => null); const existingSha = !Array.isArray(existing) && existing?.type === "file" ? existing.sha : null;
      if (action === "create" && existingSha) throw new Error(`File already exists: ${path}`); if (action === "update" && !existingSha) throw new Error(`File does not exist: ${path}`); if (item?.expectedSha && existingSha && item.expectedSha !== existingSha) throw new Error(`File changed since review: ${path}`);
      const written = await github(`/repos/${repo}/contents/${path}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: `feat(ide): apply ${path}`, content: Buffer.from(content, "utf8").toString("base64"), branch, ...(existingSha ? { sha: existingSha } : {}) }) });
      results.push({ path, action, commitSha: written?.commit?.sha || "" });
    }
    return NextResponse.json({ ok: true, repo, branch, files: results });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Apply failed" }, { status: 500 }); }
}
