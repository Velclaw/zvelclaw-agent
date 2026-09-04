import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const CODE_MODEL = process.env.ZVELCLAW_CODE_MODEL || process.env.OPENAI_CODE_MODEL || "gpt-5.1-codex-max";

async function requireAccess() {
  if (process.env.NODE_ENV === "development") return true;
  const session = await auth.api.getSession({ headers: await headers() });
  return Boolean(session);
}

const SYSTEM_PROMPT = `You are Zvelclaw Code Engine, an autonomous senior software engineer operating inside a repository-aware IDE.

Your job is to inspect the supplied repository context, understand the user's task, and produce a safe, minimal implementation plan plus complete file replacements when code changes are required.

Rules:
- Never invent files or APIs when repository context contradicts them.
- Prefer small, focused changes.
- Preserve existing architecture and conventions.
- Explain dependencies between edits.
- For every edited file, return the COMPLETE new file content, not a patch fragment.
- Do not include markdown fences inside file content.
- Do not claim that code was built, tested, committed, pushed, or deployed. You only plan and generate changes.
- If context is insufficient, say exactly what file(s) must be loaded next.

Return JSON matching the requested schema.`;

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
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured on the server" }, { status: 503 });
    }

    const body = await request.json();
    const task = typeof body?.task === "string" ? body.task.trim() : "";
    const repo = typeof body?.repo === "string" ? body.repo : "Velclaw/zvelclaw-agent";
    const ref = typeof body?.ref === "string" ? body.ref : "main";
    const files = Array.isArray(body?.files) ? body.files : [];

    if (!task) return NextResponse.json({ error: "task is required" }, { status: 400 });
    if (task.length > 12000) return NextResponse.json({ error: "task is too long" }, { status: 400 });
    if (files.length > 12) return NextResponse.json({ error: "Load at most 12 files per code-engine request" }, { status: 400 });

    const context = files
      .map((file: { path?: string; content?: string }) => `FILE: ${file.path || "unknown"}\n${file.content || ""}`)
      .join("\n\n---\n\n");

    const userPrompt = `Repository: ${repo}\nRef: ${ref}\n\nUSER TASK:\n${task}\n\nREPOSITORY CONTEXT:\n${context || "No file contents supplied. Ask for the minimum files needed."}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CODE_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "zvelclaw_code_plan", strict: true, schema },
        },
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.error?.message || `OpenAI request failed (${response.status})` },
        { status: response.status >= 500 ? 502 : 400 },
      );
    }

    const raw = payload?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return NextResponse.json({ error: "Code engine returned no content" }, { status: 502 });

    const result = JSON.parse(raw);
    return NextResponse.json({ model: CODE_MODEL, repo, ref, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Code engine request failed" },
      { status: 500 },
    );
  }
}
