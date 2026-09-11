import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const DEFAULT_REPO = "Velclaw/zvelclaw-agent";
const GITHUB_API = "https://api.github.com";
const WORKFLOW = "zvelclaw-build.yml";

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
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error("Invalid repository format.");
  return repo;
}

function validateBranch(value: unknown) {
  if (typeof value !== "string" || !value || value === "main" || value === "master") {
    throw new Error("Builds from the default branch are blocked.");
  }
  if (!/^(feature|fix|chore|codex|zvelclaw)\/[A-Za-z0-9._/-]+$/.test(value)) {
    throw new Error("Invalid IDE branch name.");
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

    await github(`/repos/${repo}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: branch, inputs: { ref: branch } }),
    });

    return NextResponse.json({ ok: true, repo, branch, workflow: WORKFLOW });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Build trigger failed" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!(await requireAccess())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const repo = parseRepo(request.nextUrl.searchParams.get("repo"));
    const branch = validateBranch(request.nextUrl.searchParams.get("branch"));
    const data = await github(
      `/repos/${repo}/actions/workflows/${WORKFLOW}/runs?branch=${encodeURIComponent(branch)}&per_page=10`,
    );
    const run = data?.workflow_runs?.[0] ?? null;
    return NextResponse.json({
      repo,
      branch,
      run: run
        ? {
            id: run.id,
            status: run.status,
            conclusion: run.conclusion,
            htmlUrl: run.html_url,
            createdAt: run.created_at,
            updatedAt: run.updated_at,
            runNumber: run.run_number,
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Build status lookup failed" },
      { status: 500 },
    );
  }
}
