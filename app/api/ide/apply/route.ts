import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const DEFAULT_REPO = "Velclaw/zvelclaw-agent";
const GITHUB_API = "https://api.github.com";
const MAX_FILES = 20;
const MAX_FILE_SIZE = 500_000;

async function requireAccess() {
  if (process.env.NODE_ENV === "development") return true;
  const session = await auth.api.getSession({ headers: await headers() });
  return Boolean(session);
}

function githubHeaders() {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {}),
  };
}

function parseRepo(value: unknown) {
  const repo = typeof value === "string" && value ? value : DEFAULT_REPO;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new Error("Invalid repository format. Use owner/name.");
  }
  return repo;
}

function validateBranch(branch: unknown) {
  if (typeof branch !== "string" || !branch || branch === "main" || branch === "master") {
    throw new Error("Writes to the default branch are blocked.");
  }
  if (!/^(feature|fix|chore|codex|zvelclaw)\/[A-Za-z0-9._/-]+$/.test(branch)) {
    throw new Error("Target branch must use a feature/fix/chore/codex/zvelclaw prefix.");
  }
  return branch;
}

function validatePath(path: unknown) {
  if (typeof path !== "string" || !path || path.length > 400) {
    throw new Error("Invalid file path.");
  }
  if (path.startsWith("/") || path.includes("..") || path.includes("\\") || path.includes("\0")) {
    throw new Error(`Unsafe file path: ${path}`);
  }
  return path;
}

async function github(path: string, init?: RequestInit) {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not configured.");
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: { ...githubHeaders(), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message || `GitHub request failed (${response.status})`);
  }
  return body;
}

export async function POST(request: NextRequest) {
  try {
    if (!(await requireAccess())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const repo = parseRepo(body?.repo);
    const baseRef = typeof body?.baseRef === "string" && body.baseRef ? body.baseRef : "main";
    const branch = validateBranch(body?.branch);
    const files = Array.isArray(body?.files) ? body.files : [];

    if (files.length === 0 || files.length > MAX_FILES) {
      return NextResponse.json({ error: `files must contain 1-${MAX_FILES} items.` }, { status: 400 });
    }

    // Confirm the target branch exists. The endpoint intentionally does not create
    // branches: the UI creates an isolated branch before applying a proposal.
    await github(`/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);

    const results: Array<{ path: string; action: string; commitSha: string }> = [];

    for (const item of files) {
      const path = validatePath(item?.path);
      const content = typeof item?.content === "string" ? item.content : "";
      const action = item?.action === "create" ? "create" : "update";
      if (Buffer.byteLength(content, "utf8") > MAX_FILE_SIZE) {
        throw new Error(`File is too large: ${path}`);
      }

      const existingResponse = await fetch(
        `${GITHUB_API}/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,
        { headers: githubHeaders(), cache: "no-store" },
      );
      const existing = await existingResponse.json().catch(() => null);
      const existingSha = !Array.isArray(existing) && existing?.type === "file" ? existing.sha : null;

      if (action === "create" && existingSha) {
        throw new Error(`File already exists: ${path}`);
      }
      if (action === "update" && !existingSha) {
        throw new Error(`File does not exist: ${path}`);
      }
      if (item?.expectedSha && existingSha && item.expectedSha !== existingSha) {
        throw new Error(`File changed since review: ${path}`);
      }

      const payload = {
        message: `feat(ide): apply ${path}`,
        content: Buffer.from(content, "utf8").toString("base64"),
        branch,
        ...(existingSha ? { sha: existingSha } : {}),
      };

      const written = await github(`/repos/${repo}/contents/${path}`, {
        method: "PUT",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      results.push({ path, action, commitSha: written?.commit?.sha || "" });
    }

    return NextResponse.json({ ok: true, repo, branch, files: results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Apply failed" },
      { status: 500 },
    );
  }
}
