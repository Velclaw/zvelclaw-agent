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
    ...(process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {}),
  };
}

function parseRepo(value: string | null) {
  const repo = value || DEFAULT_REPO;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new Error("Invalid repository format. Use owner/name.");
  }
  return repo;
}

async function github(path: string, init?: RequestInit) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: { ...githubHeaders(), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message || `GitHub request failed (${response.status})`;
    throw new Error(message);
  }
  return body;
}

export async function GET(request: NextRequest) {
  try {
    if (!(await requireAccess())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const repo = parseRepo(searchParams.get("repo"));
    const ref = searchParams.get("ref") || "main";
    const path = searchParams.get("path") || "";

    if (path) {
      const data = await github(`/repos/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`);
      if (Array.isArray(data) || data.type !== "file") {
        return NextResponse.json({ error: "Path is not a file" }, { status: 400 });
      }
      const content = Buffer.from(data.content || "", "base64").toString("utf8");
      return NextResponse.json({ repo, ref, path, sha: data.sha, content });
    }

    const data = await github(`/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`);
    const tree = (data.tree || [])
      .filter((item: { type: string; path: string }) => item.type === "blob")
      .map((item: { path: string; sha: string; size?: number }) => ({
        path: item.path,
        sha: item.sha,
        size: item.size ?? null,
      }));

    return NextResponse.json({ repo, ref, truncated: Boolean(data.truncated), tree });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Repository request failed" },
      { status: 500 },
    );
  }
}
