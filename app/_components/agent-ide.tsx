"use client";

import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { AlertTriangleIcon, BotIcon, CheckCircle2Icon, ChevronDownIcon, ChevronRightIcon, CircleDotIcon, Code2Icon, FileCode2Icon, FolderIcon, GitBranchIcon, Loader2Icon, PlayIcon, SearchIcon, SendIcon, SparklesIcon, TerminalIcon, WrenchIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type TreeFile = { path: string; sha: string; size: number | null };
type EngineFile = { path: string; action: "create" | "update"; reason: string; content: string };
type EngineResult = { summary: string; plan: string[]; risks: string[]; files: EngineFile[]; nextStep: string };
type BuildRun = { id: number; name?: string; status: string; conclusion: string | null; htmlUrl: string; createdAt: string; updatedAt: string };

const REPO = "Velclaw/zvelclaw-agent";
const BASE_REF = "main";

export function AgentIDE() {
  const [tree, setTree] = useState<TreeFile[]>([]);
  const [activeFile, setActiveFile] = useState("agent/agent.ts");
  const [fileContent, setFileContent] = useState("");
  const [fileSha, setFileSha] = useState("");
  const [task, setTask] = useState("");
  const [result, setResult] = useState<EngineResult | null>(null);
  const [branch, setBranch] = useState("");
  const [build, setBuild] = useState<BuildRun | null>(null);
  const [fixResult, setFixResult] = useState<EngineResult | null>(null);
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);
  const [runningAgent, setRunningAgent] = useState(false);
  const [runningFix, setRunningFix] = useState(false);
  const [applying, setApplying] = useState(false);
  const [buildState, setBuildState] = useState<"idle" | "running" | "passed" | "failed">("idle");
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<"review" | "agent" | "problems">("agent");
  const [tab, setTab] = useState<"editor" | "diff">("editor");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ app: true, agent: true });

  useEffect(() => { void loadTree(); }, []);
  useEffect(() => { if (activeFile) void loadFile(activeFile); }, [activeFile]);

  async function loadTree() {
    setLoadingTree(true); setError("");
    try {
      const r = await fetch(`/api/ide/repository?repo=${encodeURIComponent(REPO)}&ref=${encodeURIComponent(BASE_REF)}`, { cache: "no-store" });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Repository load failed"); setTree(d.tree || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Repository load failed"); } finally { setLoadingTree(false); }
  }

  async function loadFile(path: string) {
    setLoadingFile(true);
    try {
      const r = await fetch(`/api/ide/repository?repo=${encodeURIComponent(REPO)}&ref=${encodeURIComponent(BASE_REF)}&path=${encodeURIComponent(path)}`, { cache: "no-store" });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "File load failed"); setFileContent(d.content || ""); setFileSha(d.sha || "");
    } catch (e) { setError(e instanceof Error ? e.message : "File load failed"); } finally { setLoadingFile(false); }
  }

  async function runAgent() {
    if (!task.trim() || runningAgent) return;
    setRunningAgent(true); setPanel("review"); setError("");
    try {
      const files = [{ path: activeFile, content: fileContent, sha: fileSha }];
      const packageFile = tree.find((f) => f.path === "package.json");
      if (packageFile && packageFile.path !== activeFile) {
        const r = await fetch(`/api/ide/repository?repo=${encodeURIComponent(REPO)}&ref=${encodeURIComponent(BASE_REF)}&path=package.json`, { cache: "no-store" });
        const d = await r.json(); if (r.ok) files.push({ path: "package.json", content: d.content, sha: d.sha });
      }
      const r = await fetch("/api/ide/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repo: REPO, ref: BASE_REF, task: task.trim(), files }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Code engine failed"); setResult(d); setFixResult(null); setTask(""); setTab("diff");
    } catch (e) { setError(e instanceof Error ? e.message : "Code engine failed"); } finally { setRunningAgent(false); }
  }

  async function applyChanges() {
    if (!result?.files.length || applying) return;
    await applyResult(result);
  }

  async function applyFix() {
    if (!fixResult?.files.length || applying) return;
    await applyResult(fixResult);
    setFixResult(null);
  }

  async function applyResult(nextResult: EngineResult) {
    setApplying(true); setError(""); setBuild(null); setBuildState("idle");
    const safeName = `zvelclaw/${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}`;
    try {
      const branchName = branch || safeName;
      const r = await fetch("/api/ide/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repo: REPO, baseRef: BASE_REF, branch: branchName, files: nextResult.files }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Apply failed");
      setBranch(d.branch); setBuildState("running");
      await waitForBuild(d.branch);
    } catch (e) { setError(e instanceof Error ? e.message : "Apply failed"); setBuildState("failed"); } finally { setApplying(false); }
  }

  async function waitForBuild(targetBranch: string) {
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((resolve) => window.setTimeout(resolve, 3000));
      const r = await fetch(`/api/ide/build/status?repo=${encodeURIComponent(REPO)}&branch=${encodeURIComponent(targetBranch)}`, { cache: "no-store" });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Build status failed");
      const run = d.run as BuildRun | null; if (!run) continue;
      setBuild(run);
      if (run.status === "completed") { setBuildState(run.conclusion === "success" ? "passed" : "failed"); return; }
    }
    throw new Error("Build is still running. Open GitHub Actions to continue monitoring it.");
  }

  async function refreshBuild() {
    if (!branch) return;
    try {
      const r = await fetch(`/api/ide/build/status?repo=${encodeURIComponent(REPO)}&branch=${encodeURIComponent(branch)}`, { cache: "no-store" });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Build status failed"); setBuild(d.run);
      if (d.run?.status === "completed") setBuildState(d.run.conclusion === "success" ? "passed" : "failed");
    } catch (e) { setError(e instanceof Error ? e.message : "Build status failed"); }
  }

  async function runFix() {
    if (!branch || !build || build.conclusion !== "failure" || runningFix || applying) return;
    setRunningFix(true); setPanel("review"); setError("");
    try {
      const files = [{ path: activeFile, content: fileContent, sha: fileSha }];
      const packageFile = tree.find((f) => f.path === "package.json");
      if (packageFile && packageFile.path !== activeFile) {
        const r = await fetch(`/api/ide/repository?repo=${encodeURIComponent(REPO)}&ref=${encodeURIComponent(branch)}&path=package.json`, { cache: "no-store" });
        const d = await r.json(); if (r.ok) files.push({ path: "package.json", content: d.content, sha: d.sha });
      }
      const r = await fetch("/api/ide/fix", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repo: REPO, branch, runId: build.id, files }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "AI fix failed");
      setFixResult(d); setTab("diff");
    } catch (e) { setError(e instanceof Error ? e.message : "AI fix failed"); } finally { setRunningFix(false); }
  }

  const statusText = loadingTree ? "Loading repository…" : loadingFile ? "Loading file…" : runningAgent ? "Zvelclaw is thinking…" : runningFix ? "Diagnosing CI failure…" : applying ? "Applying changes…" : buildState === "running" ? "Build running…" : buildState === "passed" ? "Build passed" : buildState === "failed" ? "Build failed" : "Ready";
  const grouped = useMemo(() => groupTree(tree), [tree]);
  const reviewResult = fixResult || result;

  return <main className="flex h-dvh min-w-0 flex-col overflow-hidden bg-[#0b0d10] text-zinc-100">
    <header className="flex h-12 shrink-0 items-center border-b border-white/10 bg-[#0f1115] px-3 text-sm">
      <div className="flex items-center gap-2 pr-4 font-semibold"><div className="grid size-6 place-items-center rounded-md bg-white text-black"><Code2Icon className="size-4" /></div>Zvelclaw <span className="text-zinc-500">IDE</span></div>
      <div className="mx-2 h-5 w-px bg-white/10" /><div className="rounded-md px-2 py-1.5 text-zinc-300">{REPO.split("/")[1]}</div><div className="ml-2 flex items-center gap-1 text-zinc-400"><GitBranchIcon className="size-3.5" /> {branch || BASE_REF}</div>
      <div className="ml-auto flex items-center gap-1"><ToolbarButton icon={<WrenchIcon />} label={applying ? "Applying" : "Apply"} onClick={fixResult ? applyFix : applyChanges} disabled={!(fixResult?.files.length || result?.files.length) || applying} /><ToolbarButton icon={<SparklesIcon />} label="Review" onClick={() => setPanel("review")} /><ToolbarButton icon={<BotIcon />} label="Agent" onClick={() => setPanel("agent")} /><button onClick={refreshBuild} disabled={!branch} className="ml-1 flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 font-medium text-black disabled:opacity-40"><PlayIcon className="size-3.5 fill-current" /> Build</button></div>
    </header>

    <div className="flex min-h-0 flex-1">
      <aside className="hidden w-60 shrink-0 border-r border-white/10 bg-[#0d0f13] md:block"><div className="flex h-10 items-center justify-between border-b border-white/10 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Explorer <button onClick={loadTree} aria-label="Refresh"><SearchIcon className="size-3.5" /></button></div><div className="p-2 text-[12px]"><div className="mb-2 px-2 text-zinc-500">{tree.length ? `${tree.length} files` : "Repository files"}</div>{loadingTree ? <div className="px-2 text-zinc-600">Loading GitHub tree…</div> : <ExplorerTree groups={grouped} expanded={expanded} setExpanded={setExpanded} activeFile={activeFile} onSelect={setActiveFile} />}</div></aside>

      <section className="flex min-w-0 flex-1 flex-col"><div className="flex h-10 shrink-0 items-center border-b border-white/10 bg-[#101217]"><button onClick={() => setTab("editor")} className={cn("flex h-full items-center gap-2 border-r border-white/10 px-3 text-xs", tab === "editor" ? "bg-[#0b0d10] text-white" : "text-zinc-500")}><FileCode2Icon className="size-3.5" />{activeFile.split("/").pop()}</button><button onClick={() => setTab("diff")} className={cn("flex h-full items-center gap-2 border-r border-white/10 px-3 text-xs", tab === "diff" ? "bg-[#0b0d10] text-white" : "text-zinc-500")}>AI Diff {reviewResult?.files.length ? `(${reviewResult.files.length})` : ""}</button></div>{error && <div className="border-b border-red-400/20 bg-red-400/5 px-4 py-2 text-xs text-red-300">{error}</div>}<div className="min-h-0 flex-1 overflow-auto font-mono text-[12px] leading-6">{tab === "editor" ? <Editor content={fileContent} loading={loadingFile} /> : <DiffView result={reviewResult} />}</div><div className="border-t border-white/10 bg-[#0d0f13]"><div className="flex h-9 items-center gap-4 px-3 text-[11px]"><button onClick={() => setPanel("problems")} className="flex items-center gap-1.5 text-zinc-500"><AlertTriangleIcon className="size-3.5" /> Problems <span className="rounded bg-red-500/15 px-1.5 text-red-300">{error || buildState === "failed" ? 1 : 0}</span></button><span className="flex items-center gap-1.5 text-zinc-500"><TerminalIcon className="size-3.5" /> Terminal</span><span className="ml-auto text-zinc-500">{statusText}</span></div><div className="h-20 overflow-auto border-t border-white/5 px-3 py-2 font-mono text-[11px] text-zinc-500"><div>$ zvelclaw inspect --ref {branch || BASE_REF}</div><div className="text-zinc-400">✓ GitHub repository tree: {tree.length} files</div>{build && <div>CI: {build.status}{build.conclusion ? ` / ${build.conclusion}` : ""} — run #{build.id}</div>}{build?.htmlUrl && <div className="text-zinc-400">{build.htmlUrl}</div>}</div></div></section>

      <aside className="hidden w-96 shrink-0 border-l border-white/10 bg-[#0d0f13] lg:flex lg:flex-col"><div className="flex h-10 items-center border-b border-white/10 px-3"><div className="flex gap-1 text-xs"><PanelTab active={panel === "review"} onClick={() => setPanel("review")}>AI Review</PanelTab><PanelTab active={panel === "agent"} onClick={() => setPanel("agent")}>Agent</PanelTab><PanelTab active={panel === "problems"} onClick={() => setPanel("problems")}>Problems</PanelTab></div></div><div className="min-h-0 flex-1 overflow-auto p-3">{panel === "review" && <ReviewPanel result={reviewResult} applying={applying} onApply={fixResult ? applyFix : applyChanges} buildState={buildState} branch={branch} isFix={Boolean(fixResult)} />}{panel === "agent" && <AgentPanel task={task} setTask={setTask} onRun={runAgent} running={runningAgent} />}{panel === "problems" && <ProblemsPanel error={error} build={build} runningFix={runningFix} onFix={runFix} />}</div></aside>
    </div>
    <footer className="flex h-6 shrink-0 items-center justify-between border-t border-white/10 bg-[#0a0c0f] px-3 text-[10px] text-zinc-500"><div className="flex gap-4"><span>{branch || BASE_REF}</span><span>{reviewResult?.files.length || 0} proposed changes</span><span>CI {buildState}</span></div><div className="flex items-center gap-1.5"><CircleDotIcon className="size-3 text-emerald-400" /> Zvelclaw Agent ready</div></footer>
  </main>;
}

function groupTree(tree: TreeFile[]) { const folders = new Map<string, TreeFile[]>(); const root: TreeFile[] = []; for (const f of tree) { const p = f.path.split("/"); if (p.length === 1) root.push(f); else { const a = folders.get(p[0]) || []; a.push({ ...f, path: p.slice(1).join("/") }); folders.set(p[0], a); } } return { folders: [...folders.entries()].sort(), root: root.sort((a,b) => a.path.localeCompare(b.path)) }; }
function ExplorerTree({ groups, expanded, setExpanded, activeFile, onSelect }: { groups: ReturnType<typeof groupTree>; expanded: Record<string, boolean>; setExpanded: Dispatch<SetStateAction<Record<string, boolean>>>; activeFile: string; onSelect: (path: string) => void }) { return <>{groups.folders.map(([folder, files]) => <div key={folder}><button onClick={() => setExpanded(v => ({ ...v, [folder]: !v[folder] }))} className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-zinc-300 hover:bg-white/5">{expanded[folder] ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}<FolderIcon className="size-3.5" />{folder}</button>{expanded[folder] && <div className="ml-5 border-l border-white/10 pl-1">{files.map(f => <FileRow key={f.path} name={f.path} active={activeFile === `${folder}/${f.path}`} onClick={() => onSelect(`${folder}/${f.path}`)} />)}</div>}</div>)}{groups.root.map(f => <FileRow key={f.path} name={f.path} active={activeFile === f.path} onClick={() => onSelect(f.path)} />)}</>; }
function FileRow({ name, active, onClick }: { name: string; active: boolean; onClick: () => void }) { return <button onClick={onClick} className={cn("flex w-full items-center gap-2 rounded px-2 py-1 text-left text-zinc-400 hover:bg-white/5", active && "bg-white/10 text-white")}><FileCode2Icon className="size-3.5" />{name}</button>; }
function Editor({ content, loading }: { content: string; loading: boolean }) { if (loading) return <div className="p-5 text-zinc-600">Loading file from GitHub…</div>; return <div className="min-w-[700px] p-4">{(content || "No file content.").split("\n").map((line,i) => <div key={i} className="flex min-h-6"><span className="w-12 shrink-0 select-none pr-4 text-right text-zinc-700">{i+1}</span><span className="whitespace-pre text-zinc-300">{line || " "}</span></div>)}</div>; }
function DiffView({ result }: { result: EngineResult | null }) { if (!result) return <div className="p-5 text-zinc-600">No AI proposal yet.</div>; return <div className="space-y-4 p-4">{result.files.map(f => <div key={f.path} className="rounded-lg border border-white/10"><div className="border-b border-white/10 px-3 py-2 text-xs text-zinc-300">{f.action.toUpperCase()} {f.path}</div><pre className="max-h-96 overflow-auto p-3 text-[11px] text-zinc-400">{f.content}</pre></div>)}</div>; }
function ReviewPanel({ result, applying, onApply, buildState, branch, isFix }: { result: EngineResult | null; applying: boolean; onApply: () => void; buildState: string; branch: string; isFix: boolean }) { if (!result) return <Empty icon={<SparklesIcon />} title="AI Review" text="Ask the agent to generate a code change proposal." />; return <div className="space-y-4"><Section title={isFix ? "AI CI Fix" : "Summary"}><p className="text-xs leading-5 text-zinc-300">{result.summary}</p></Section><Section title="Plan"><ul className="space-y-2 text-xs text-zinc-400">{result.plan.map((x,i)=><li key={i}>• {x}</li>)}</ul></Section><Section title="Changes"><div className="space-y-2">{result.files.length ? result.files.map(f=><div key={f.path} className="rounded border border-white/10 p-2 text-xs"><div className="text-zinc-200">{f.action} {f.path}</div><div className="mt-1 text-zinc-500">{f.reason}</div></div>) : <div className="text-xs text-zinc-500">No safe file changes were proposed.</div>}</div></Section>{result.files.length > 0 && <button onClick={onApply} disabled={applying} className="flex w-full items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">{applying ? <Loader2Icon className="size-3.5 animate-spin" /> : <CheckCircle2Icon className="size-3.5" />}{applying ? "Applying + building…" : isFix ? "Apply fix + rebuild" : branch ? "Apply again" : "Apply to isolated branch"}</button>}{branch && <div className="text-[11px] text-zinc-500">Branch: {branch}<br/>CI: {buildState}</div>}</div>; }
function AgentPanel({ task, setTask, onRun, running }: { task: string; setTask: (v: string) => void; onRun: () => void; running: boolean }) { return <div className="flex h-full flex-col"><div className="mb-3 flex items-center gap-2"><BotIcon className="size-4" /><div><div className="text-sm font-medium">Zvelclaw Agent</div><div className="text-[11px] text-zinc-500">Inspect → Plan → Edit → Verify</div></div></div><textarea value={task} onChange={e=>setTask(e.target.value)} placeholder="Describe the change you want…" className="min-h-36 flex-1 resize-none rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-zinc-200 outline-none placeholder:text-zinc-600" /><button onClick={onRun} disabled={!task.trim() || running} className="mt-3 flex items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-40">{running ? <Loader2Icon className="size-3.5 animate-spin" /> : <SendIcon className="size-3.5" />}Generate proposal</button></div>; }
function ProblemsPanel({ error, build, runningFix, onFix }: { error: string; build: BuildRun | null; runningFix: boolean; onFix: () => void }) { const failed = build?.status === "completed" && build.conclusion === "failure"; return <div className="space-y-3"><div className="text-sm font-medium">Problems</div>{error ? <div className="rounded border border-red-400/20 bg-red-400/5 p-3 text-xs text-red-300">{error}</div> : failed ? <div className="rounded border border-red-400/20 bg-red-400/5 p-3 text-xs text-red-300">GitHub Actions build failed on this isolated branch.</div> : <div className="text-xs text-zinc-600">No local IDE errors.</div>}{failed && <button onClick={onFix} disabled={runningFix} className="flex w-full items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">{runningFix ? <Loader2Icon className="size-3.5 animate-spin" /> : <WrenchIcon className="size-3.5" />}{runningFix ? "Analyzing CI failure…" : "Ask Zvelclaw to fix"}</button>}{build?.htmlUrl && <a href={build.htmlUrl} target="_blank" rel="noreferrer" className="block text-xs text-zinc-400 hover:text-white">Open GitHub Actions run →</a>}</div>; }
function Section({ title, children }: { title: string; children: ReactNode }) { return <section><div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{title}</div>{children}</section>; }
function Empty({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className="grid h-full place-items-center p-6 text-center"><div><div className="mx-auto mb-2 grid size-8 place-items-center rounded-lg bg-white/5 text-zinc-400">{icon}</div><div className="text-sm font-medium">{title}</div><p className="mt-1 text-xs text-zinc-600">{text}</p></div></div>; }
function PanelTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) { return <button onClick={onClick} className={cn("rounded px-2 py-1 text-zinc-500", active && "bg-white/10 text-white")}>{children}</button>; }
function ToolbarButton({ icon, label, onClick, disabled }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) { return <button onClick={onClick} disabled={disabled} className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40">{icon}<span className="hidden xl:inline">{label}</span></button>; }
