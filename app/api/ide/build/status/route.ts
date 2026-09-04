import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const DEFAULT_REPO = "Velclaw/zvelclaw-agent";
const GITHUB_API = "https://api.github.com";

async function access() {
  if (process.env.NODE_ENV === "development") return true;
  return Boolean(await auth.api.getSession({ headers: await headers() }));
}
function repoOf(value: string | null) {
  const repo = value || DEFAULT_REPO;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error("Invalid repository.");
  return repo;
}
function branchOf(value: string | null) {
  if (!value || value === "main" || value === "master" || !/^(feature|fix|chore|codex|zvelclaw)\/[A-Za-z0-9._/-]+$/.test(value)) throw new Error("Invalid build branch.");
  return value;
}
async function github(path: string) {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not configured.");
  const response = await fetch(`${GITHUB_API}${path}`, { headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }, cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || `GitHub request failed (${response.status})`);
  return body;
}

export async function GET(request: NextRequest) {
  try {
    if (!(await access())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const params = request.nextUrl.searchParams;
    const repo = repoOf(params.get("repo"));
    const branch = branchOf(params.get("branch"));
    const data = await github(`/repos/${repo}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=10`);
    const runs = (data.workflow_runs || []).map((run: any) => ({ id: run.id, name: run.name, status: run.status, conclusion: run.conclusion, htmlUrl: run.html_url, createdAt: run.created_at, updatedAt: run.updated_at }));
    return NextResponse.json({ repo, branch, run: runs[0] || null, runs });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Build status failed" }, { status: 500 });
  }
}
