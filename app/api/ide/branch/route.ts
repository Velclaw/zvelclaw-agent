import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const DEFAULT_REPO = "Velclaw/zvelclaw-agent";
const GITHUB_API = "https://api.github.com";

async function requireAccess() {
  if (process.env.NODE_ENV === "development") return true;
  const session = await auth.api.getSession({ headers: await headers() });
  return Boolean(session);
}

function githubHeaders() {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
  };
}

function parseRepo(value: unknown) {
  const repo = typeof value === "string" && value ? value : DEFAULT_REPO;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error("Invalid repository format.");
  return repo;
}

function validateBranch(value: unknown) {
  if (typeof value !== "string" || !/^(feature|fix|chore|codex|zvelclaw)\/[A-Za-z0-9._/-]+$/.test(value)) {
    throw new Error("Branch must use feature/fix/chore/codex/zvelclaw prefix.");
  }
  return value;
}

async function github(path: string, init?: RequestInit) {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not configured.");
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: { ...githubHeaders(), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || `GitHub request failed (${response.status})`);
  return body;
}

export async function POST(request: NextRequest) {
  try {
    if (!(await requireAccess())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const repo = parseRepo(body?.repo);
    const branch = validateBranch(body?.branch);
    const baseRef = typeof body?.baseRef === "string" && body.baseRef ? body.baseRef : "main";

    const existing = await fetch(`${GITHUB_API}/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, {
      headers: githubHeaders(), cache: "no-store",
    });
    if (existing.ok) return NextResponse.json({ ok: true, repo, branch, created: false });

    const base = await github(`/repos/${repo}/git/ref/heads/${encodeURIComponent(baseRef)}`);
    await github(`/repos/${repo}/git/refs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha }),
    });

    return NextResponse.json({ ok: true, repo, branch, baseRef, created: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Branch creation failed" }, { status: 500 });
  }
}
