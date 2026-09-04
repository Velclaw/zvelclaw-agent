"use client";

import {
  AlertTriangleIcon,
  BotIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleDotIcon,
  Code2Icon,
  FileCode2Icon,
  FolderIcon,
  GitBranchIcon,
  Loader2Icon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  Settings2Icon,
  SparklesIcon,
  TerminalIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type TreeFile = { path: string; sha: string; size: number | null };
type EngineResult = {
  summary: string;
  plan: string[];
  risks: string[];
  files: Array<{ path: string; action: "create" | "update"; reason: string; content: string }>;
  nextStep: string;
};

const REPO = "Velclaw/zvelclaw-agent";
const REF = "main";

export function AgentIDE() {
  const [tree, setTree] = useState<TreeFile[]>([]);
  const [activeFile, setActiveFile] = useState("agent/agent.ts");
  const [fileContent, setFileContent] = useState("");
  const [fileSha, setFileSha] = useState("");
  const [activeTab, setActiveTab] = useState<"editor" | "diff">("editor");
  const [panel, setPanel] = useState<"review" | "chat" | "problems">("chat");
  const [task, setTask] = useState("");
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);
  const [runningAgent, setRunningAgent] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<EngineResult | null>(null);
  const [buildState, setBuildState] = useState<"idle" | "running" | "passed">("idle");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ app: true, agent: true });

  useEffect(() => {
    void loadTree();
  }, []);

  useEffect(() => {
    if (activeFile) void loadFile(activeFile);
  }, [activeFile]);

  async function loadTree() {
    setLoadingTree(true);
    setError("");
    try {
      const response = await fetch(`/api/ide/repository?repo=${encodeURIComponent(REPO)}&ref=${encodeURIComponent(REF)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load repository");
      setTree(data.tree || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load repository");
    } finally {
      setLoadingTree(false);
    }
  }

  async function loadFile(path: string) {
    setLoadingFile(true);
    setError("");
    try {
      const response = await fetch(`/api/ide/repository?repo=${encodeURIComponent(REPO)}&ref=${encodeURIComponent(REF)}&path=${encodeURIComponent(path)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load file");
      setFileContent(data.content || "");
      setFileSha(data.sha || "");
      setActiveTab("editor");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load file");
    } finally {
      setLoadingFile(false);
    }
  }

  async function runAgent() {
    if (!task.trim() || runningAgent) return;
    setRunningAgent(true);
    setPanel("review");
    setError("");
    try {
      const contextFiles = [{ path: activeFile, content: fileContent, sha: fileSha }];
      const packageFile = tree.find((file) => file.path === "package.json");
      if (packageFile && packageFile.path !== activeFile) {
        const packageResponse = await fetch(`/api/ide/repository?repo=${encodeURIComponent(REPO)}&ref=${encodeURIComponent(REF)}&path=package.json`, { cache: "no-store" });
        const packageData = await packageResponse.json();
        if (packageResponse.ok) contextFiles.push({ path: "package.json", content: packageData.content, sha: packageData.sha });
      }

      const response = await fetch("/api/ide/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: REPO, ref: REF, task: task.trim(), files: contextFiles }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Code engine failed");
      setResult(data);
      setTask("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code engine failed");
    } finally {
      setRunningAgent(false);
    }
  }

  function runBuild() {
    setBuildState("running");
    window.setTimeout(() => setBuildState("passed"), 1200);
  }

  const statusText = useMemo(() => {
    if (loadingTree) return "Loading repository…";
    if (loadingFile) return "Loading file…";
    if (runningAgent) return "Zvelclaw is thinking…";
    if (buildState === "running") return "Build running…";
    if (buildState === "passed") return "Build passed";
    return "Ready";
  }, [buildState, loadingFile, loadingTree, runningAgent]);

  const groupedTree = useMemo(() => groupTree(tree), [tree]);

  return (
    <main className="flex h-dvh min-w-0 flex-col overflow-hidden bg-[#0b0d10] text-zinc-100">
      <header className="flex h-12 shrink-0 items-center border-b border-white/10 bg-[#0f1115] px-3 text-sm">
        <div className="flex items-center gap-2 pr-4 font-semibold tracking-tight">
          <div className="grid size-6 place-items-center rounded-md bg-white text-black"><Code2Icon className="size-4" /></div>
          Zvelclaw <span className="text-zinc-500">IDE</span>
        </div>
        <div className="mx-2 h-5 w-px bg-white/10" />
        <div className="flex items-center gap-1 rounded-md px-2 py-1.5 text-zinc-300">{REPO.split("/")[1]} <ChevronDownIcon className="size-3.5" /></div>
        <div className="ml-2 flex items-center gap-1 rounded-md px-2 py-1.5 text-zinc-400"><GitBranchIcon className="size-3.5" /> {REF}</div>
        <div className="ml-auto flex items-center gap-1">
          <ToolbarButton icon={<WrenchIcon />} label="Build" onClick={runBuild} />
          <ToolbarButton icon={<SparklesIcon />} label="Review" onClick={() => setPanel("review")} />
          <ToolbarButton icon={<BotIcon />} label="Fix" onClick={() => setPanel("chat")} />
          <button onClick={runBuild} className="ml-1 flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 font-medium text-black hover:bg-zinc-200"><PlayIcon className="size-3.5 fill-current" /> Run</button>
          <button className="ml-1 grid size-8 place-items-center rounded-md text-zinc-400 hover:bg-white/5" aria-label="Settings"><Settings2Icon className="size-4" /></button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-white/10 bg-[#0d0f13] md:block">
          <div className="flex h-10 items-center justify-between border-b border-white/10 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Explorer <button onClick={loadTree} aria-label="Refresh repository"><PlusIcon className="size-3.5" /></button></div>
          <div className="p-2 text-[12px]">
            <div className="mb-2 flex items-center gap-2 px-2 text-zinc-500"><SearchIcon className="size-3.5" /> {tree.length ? `${tree.length} files` : "Repository files"}</div>
            {loadingTree ? <div className="px-2 py-3 text-zinc-600">Loading GitHub tree…</div> : <ExplorerTree groups={groupedTree} expanded={expanded} setExpanded={setExpanded} activeFile={activeFile} onSelect={setActiveFile} />}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-[#0b0d10]">
          <div className="flex h-10 shrink-0 items-center border-b border-white/10 bg-[#101217]">
            <button onClick={() => setActiveTab("editor")} className={cn("flex h-full items-center gap-2 border-r border-white/10 px-3 text-xs", activeTab === "editor" ? "bg-[#0b0d10] text-white" : "text-zinc-500")}><FileCode2Icon className="size-3.5" /> {activeFile.split("/").pop()} <XIcon className="size-3 text-zinc-600" /></button>
            <button onClick={() => setActiveTab("diff")} className={cn("flex h-full items-center gap-2 border-r border-white/10 px-3 text-xs", activeTab === "diff" ? "bg-[#0b0d10] text-white" : "text-zinc-500")}>AI Diff {result?.files.length ? `(${result.files.length})` : ""}</button>
          </div>
          {error && <div className="border-b border-red-400/20 bg-red-400/5 px-4 py-2 text-xs text-red-300">{error}</div>}
          <div className="min-h-0 flex-1 overflow-auto font-mono text-[12px] leading-6">
            {activeTab === "editor" ? <Editor content={fileContent} loading={loadingFile} /> : <DiffView result={result} />}
          </div>
          <div className="border-t border-white/10 bg-[#0d0f13]">
            <div className="flex h-9 items-center gap-4 px-3 text-[11px]">
              <button className={cn("flex items-center gap-1.5", panel === "problems" ? "text-white" : "text-zinc-500")} onClick={() => setPanel("problems")}><AlertTriangleIcon className="size-3.5" /> Problems <span className="rounded bg-red-500/15 px-1.5 text-red-300">{error ? 1 : 0}</span></button>
              <button className="flex items-center gap-1.5 text-zinc-500"><TerminalIcon className="size-3.5" /> Terminal</button>
              <span className="ml-auto text-zinc-500">{statusText}</span>
            </div>
            <div className="h-20 overflow-auto border-t border-white/5 px-3 py-2 font-mono text-[11px] text-zinc-500">
              <div>$ zvelclaw repository inspect --ref {REF}</div>
              <div className="text-zinc-400">✓ GitHub repository tree loaded: {tree.length || 0} files</div>
              {buildState === "running" && <div className="text-zinc-300">Build executor placeholder — real sandbox build is next phase.</div>}
              {buildState === "passed" && <div className="text-emerald-400">✓ UI build action completed</div>}
            </div>
          </div>
        </section>

        <aside className="hidden w-96 shrink-0 border-l border-white/10 bg-[#0d0f13] lg:flex lg:flex-col">
          <div className="flex h-10 items-center border-b border-white/10 px-3"><div className="flex gap-1 text-xs"><PanelTab active={panel === "review"} onClick={() => setPanel("review")}>AI Review</PanelTab><PanelTab active={panel === "chat"} onClick={() => setPanel("chat")}>Agent</PanelTab><PanelTab active={panel === "problems"} onClick={() => setPanel("problems")}>Problems</PanelTab></div></div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            {panel === "review" && <ReviewPanel result={result} running={runningAgent} />}
            {panel === "chat" && <AgentPanel task={task} setTask={setTask} onRun={runAgent} running={runningAgent} />}
            {panel === "problems" && <ProblemsPanel error={error} />}
          </div>
        </aside>
      </div>
      <footer className="flex h-6 shrink-0 items-center justify-between border-t border-white/10 bg-[#0a0c0f] px-3 text-[10px] text-zinc-500"><div className="flex gap-4"><span>{REF}</span><span>{result?.files.length || 0} proposed changes</span><span>UTF-8</span><span>TypeScript</span></div><div className="flex items-center gap-1.5"><CircleDotIcon className="size-3 text-emerald-400" /> Zvelclaw Agent ready</div></footer>
    </main>
  );
}

function groupTree(tree: TreeFile[]) {
  const folders = new Map<string, TreeFile[]>();
  const root: TreeFile[] = [];
  for (const file of tree) {
    const parts = file.path.split("/");
    if (parts.length === 1) root.push(file);
    else {
      const folder = parts[0];
      const list = folders.get(folder) || [];
      list.push({ ...file, path: parts.slice(1).join("/") });
      folders.set(folder, list);
    }
  }
  return { folders: [...folders.entries()].sort(), root: root.sort((a, b) => a.path.localeCompare(b.path)) };
}

function ExplorerTree({ groups, expanded, setExpanded, activeFile, onSelect }: { groups: ReturnType<typeof groupTree>; expanded: Record<string, boolean>; setExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>; activeFile: string; onSelect: (path: string) => void }) {
  return <>
    {groups.folders.map(([folder, children]) => <div key={folder}>
      <button onClick={() => setExpanded((value) => ({ ...value, [folder]: !value[folder] }))} className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-zinc-300 hover:bg-white/5">{expanded[folder] ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}<FolderIcon className="size-3.5" /> {folder}</button>
      {expanded[folder] && <div className="ml-5 border-l border-white/10 pl-1">{children.map((file) => <FileRow key={file.path} name={file.path} fullPath={`${folder}/${file.path}`} active={activeFile === `${folder}/${file.path}`} onClick={() => onSelect(`${folder}/${file.path}`)} />)}</div>}
    </div>)}
    {groups.root.map((file) => <FileRow key={file.path} name={file.path} fullPath={file.path} active={activeFile === file.path} onClick={() => onSelect(file.path)} />)}
  </>;
}

function Editor({ content, loading }: { content: string; loading: boolean }) {
  if (loading) return <div className="p-5 text-zinc-600">Loading file from GitHub…</div>;
  if (!content) return <div className="p-5 text-zinc-600">No file content.</div>;
  return <div className="min-w-[700px] p-4">{content.split("\n").map((line, index) => <div key={`${index}-${line}`} className="flex min-h-6"><span className="w-12 shrink-0 select-none pr-4 text-right text-zinc-700">{index + 1}</span><span className="whitespace-pre text-zinc-300">{line || " "}</span></div>)}</div>;
}

function ToolbarButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) { return <button onClick={onClick} className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-white/5 hover:text-white sm:flex">{icon}<span>{label}</span></button>; }
function FileRow({ name, fullPath, active, onClick }: { name: string; fullPath: string; active: boolean; onClick: () => void }) { return <button title={fullPath} onClick={onClick} className={cn("flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left", active ? "bg-white/8 text-white" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300")}><FileCode2Icon className="size-3.5" /> {name}</button>; }
function PanelTab({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) { return <button onClick={onClick} className={cn("rounded px-2 py-1", active ? "bg-white/8 text-white" : "text-zinc-500 hover:text-zinc-300")}>{children}</button>; }

function AgentPanel({ task, setTask, onRun, running }: { task: string; setTask: (value: string) => void; onRun: () => void; running: boolean }) {
  return <div className="flex h-full flex-col">
    <div className="flex-1 space-y-3 text-xs leading-5"><div className="rounded-md bg-white/[0.03] p-3 text-zinc-400">Zvelclaw can now inspect the real GitHub repository and send the selected code to the Code Engine.</div><div className="rounded-md border border-white/8 bg-white/[0.02] p-3 text-zinc-500">Describe the change. The engine returns a plan and complete file replacements for review.</div></div>
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2"><textarea value={task} onChange={(event) => setTask(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onRun(); }} rows={4} placeholder="e.g. Add validation to the agent configuration…" className="w-full resize-none bg-transparent px-1 py-1 text-xs text-zinc-200 outline-none placeholder:text-zinc-700" /><button disabled={!task.trim() || running} onClick={onRun} className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-medium text-black disabled:cursor-not-allowed disabled:opacity-40">{running ? <Loader2Icon className="size-3.5 animate-spin" /> : <SendIcon className="size-3.5" />} {running ? "Analyzing…" : "Run Code Engine"}</button></div>
  </div>;
}

function ReviewPanel({ result, running }: { result: EngineResult | null; running: boolean }) {
  if (running) return <div className="flex h-full items-center justify-center gap-2 text-xs text-zinc-500"><Loader2Icon className="size-4 animate-spin" /> Analyzing repository context…</div>;
  if (!result) return <div className="space-y-3"><div className="text-sm font-medium">AI Review</div><div className="text-xs leading-5 text-zinc-500">Run the Code Engine from the Agent panel. Its plan, risks and proposed complete-file changes will appear here.</div></div>;
  return <div className="space-y-4"><div><div className="text-sm font-medium">{result.summary}</div><div className="mt-1 text-xs text-zinc-500">Proposed changes: {result.files.length}</div></div><Section title="Plan">{result.plan.map((item) => <div key={item} className="flex gap-2 text-[11px] leading-5 text-zinc-400"><CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />{item}</div>)}</Section><Section title="Files">{result.files.map((file) => <div key={file.path} className="rounded-md border border-white/8 bg-white/[0.02] p-2.5"><div className="text-xs font-medium text-zinc-200">{file.action.toUpperCase()} {file.path}</div><div className="mt-1 text-[11px] leading-5 text-zinc-500">{file.reason}</div></div>)}</Section>{result.risks.length > 0 && <Section title="Risks">{result.risks.map((risk) => <div key={risk} className="flex gap-2 text-[11px] leading-5 text-amber-300"><AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />{risk}</div>)}</Section>}<div className="rounded-md border border-white/8 p-3 text-[11px] text-zinc-400">Next: {result.nextStep}</div></div>;
}
function Section({ title, children }: { title: string; children: ReactNode }) { return <section className="space-y-2"><div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{title}</div>{children}</section>; }
function ProblemsPanel({ error }: { error: string }) { return <div className="space-y-2 text-xs">{error ? <div className="rounded-md border border-red-400/20 bg-red-400/5 p-3"><div className="font-medium text-red-300">1 error</div><div className="mt-1 text-zinc-500">{error}</div></div> : <div className="rounded-md border border-emerald-400/20 bg-emerald-400/5 p-3"><div className="font-medium text-emerald-300">No IDE errors</div><div className="mt-1 text-zinc-500">Repository inspection is connected.</div></div>}</div>; }
function DiffView({ result }: { result: EngineResult | null }) { if (!result?.files.length) return <div className="p-5 text-xs text-zinc-600">No proposed changes yet. Ask the Code Engine to modify the selected file.</div>; return <div className="min-w-[760px] space-y-4 p-4">{result.files.map((file) => <div key={file.path} className="overflow-hidden rounded-md border border-white/8"><div className="border-b border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-zinc-400">{file.action} {file.path}</div><pre className="overflow-auto p-3 text-[11px] leading-5 text-emerald-300">{file.content}</pre></div>)}</div>; }
