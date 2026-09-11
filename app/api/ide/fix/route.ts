import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const DEFAULT_REPO = "Velclaw/zvelclaw-agent";
const GITHUB_API = "https://api.github.com";
const CODE_MODEL = process.env.ZVELCLAW_CODE_MODEL || process.env.OPENAI_CODE_MODEL || "gpt-5.1-codex-max";
const MAX_LOG_CHARS = 80_000;
const MAX_FILES = 10;

async function requireAccess() {
  if (process.env.NODE_ENV === "development") return true;
  return Boolean(await auth.api.getSession({ headers: await headers() }));
}

function repoOf(value: unknown) {
  const repo = typeof value === "string" && value ? value : DEFAULT_REPO;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error("Invalid repository.");
  return repo;
}

function branchOf(value: unknown) {
  if (typeof value !== "string" || !value || value === "main" || value === "master" || !/^(feature|fix|chore|codex|zvelclaw)\/[A-Za-z0-9._/-]+$/.test(value)) {
    throw new Error("AI fixes require an isolated feature/fix/chore/codex/zvelclaw branch.");
  }
  return value;
}

function githubHeaders() {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not configured.");
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  };
}

async function github(path: string) {
  const response = await fetch(`${GITHUB_API}${path}`, { headers: githubHeaders(), cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || `GitHub request failed (${response.status})`);
  return body;
}

function sanitizeLogs(value: string) {
  return value
    .replace(/(ghp_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]+)/g, "[REDACTED_SECRET]")
    .replace(/(Authorization:\s*(?:Bearer|Basic)\s+)[^\s]+/gi, "$1[REDACTED]")
    .replace(/(password|passwd|token|secret|api[_-]?key)\s*[:=]\s*[^\s]+/gi, "$1=[REDACTED]");
}

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    plan: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    files: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: { type: "string" },
          action: { type: "string", enum: ["create", "update"] },
          reason: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "action", "reason", "content"],
      },
    },
    nextStep: { type: "string" },
  },
  required: ["summary", "plan", "risks", "files", "nextStep"],
};

export async function POST(request: NextRequest) {
  try {
    if (!(await requireAccess())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "OPENAI_API_KEY is not configured on the server" }, { status: 503 });

    const body = await request.json();
    const repo = repoOf(body?.repo);
    const branch = branchOf(body?.branch);
    const requestedRunId = Number.isInteger(body?.runId) ? body.runId : null;
    const suppliedFiles = Array.isArray(body?.files) ? body.files.slice(0, MAX_FILES) : [];

    const runs = await github(`/repos/${repo}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=10`);
    const run = requestedRunId ? (runs.workflow_runs || []).find((item: any) => item.id === requestedRunId) : runs.workflow_runs?.[0];
    if (!run) return NextResponse.json({ error: "No GitHub Actions run was found for this branch." }, { status: 404 });
    if (run.status !== "completed" || run.conclusion !== "failure") return NextResponse.json({ error: "The selected build is not a completed failure." }, { status: 409 });

    const jobsPayload = await github(`/repos/${repo}/actions/runs/${run.id}/jobs?per_page=20`);
    const failedJobs = (jobsPayload.jobs || []).filter((job: any) => job.conclusion === "failure").slice(0, 5);
    if (!failedJobs.length) return NextResponse.json({ error: "The failed run has no failed job details available." }, { status: 502 });

    const jobLogs: string[] = [];
    for (const job of failedJobs) {
      const response = await fetch(`${GITHUB_API}/repos/${repo}/actions/jobs/${job.id}/logs`, { headers: githubHeaders(), cache: "no-store" });
      const text = await response.text();
      if (response.ok) jobLogs.push(`JOB ${job.name} (#${job.id})\n${sanitizeLogs(text).slice(-25_000)}`);
    }

    const context = suppliedFiles
      .map((file: { path?: string; content?: string }) => `FILE: ${file.path || "unknown"}\n${typeof file.content === "string" ? file.content : ""}`)
      .join("\n\n---\n\n");
    const logs = jobLogs.join("\n\n===== FAILED JOB =====\n\n").slice(-MAX_LOG_CHARS);

    const system = `You are Zvelclaw Fix Engine, a senior software engineer diagnosing a real GitHub Actions failure.\n\nRules:\n- Use the actual CI logs and repository files as evidence.\n- Fix the root cause, not merely the symptom.\n- Prefer the smallest safe change.\n- Preserve the repository architecture and existing conventions.\n- Only return files that genuinely need changes.\n- For every changed file return COMPLETE file content, never a patch fragment.\n- Do not invent APIs, dependencies, files, or test results.\n- Never claim the fix has been applied, committed, pushed, or verified.\n- If the evidence is insufficient, return an empty files array and explain exactly what context is missing.\n- Never include secrets from logs in your output.\n\nReturn JSON matching the requested schema.`;

    const user = `Repository: ${repo}\nBranch: ${branch}\nFailed workflow run: #${run.id} (${run.name})\nRun URL: ${run.html_url}\n\nFAILED CI LOGS:\n${logs || "No logs were returned."}\n\nCURRENT REPOSITORY FILES:\n${context || "No source files supplied."}\n\nTask: Diagnose this CI failure and propose the minimal safe code fix.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: CODE_MODEL,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        response_format: { type: "json_schema", json_schema: { name: "zvelclaw_fix_plan", strict: true, schema } },
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) return NextResponse.json({ error: payload?.error?.message || `OpenAI request failed (${response.status})` }, { status: response.status >= 500 ? 502 : 400 });
    const raw = payload?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return NextResponse.json({ error: "Fix engine returned no content" }, { status: 502 });

    const result = JSON.parse(raw);
    return NextResponse.json({ model: CODE_MODEL, repo, branch, run: { id: run.id, name: run.name, htmlUrl: run.html_url }, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI fix failed" }, { status: 500 });
  }
}
