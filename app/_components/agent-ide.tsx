"use client";

import {
  BotIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Code2Icon,
  FileCode2Icon,
  FolderIcon,
  GitBranchIcon,
  PlayIcon,
  PlusIcon,
  SearchIcon,
  Settings2Icon,
  SparklesIcon,
  TerminalIcon,
  TestTube2Icon,
  WrenchIcon,
  XIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  CircleDotIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const files = [
  { name: "app", type: "folder", children: ["page.tsx", "layout.tsx", "globals.css"] },
  { name: "components", type: "folder", children: ["agent-ide.tsx", "ui.tsx"] },
  { name: "lib", type: "folder", children: ["utils.ts", "auth.ts"] },
  { name: "agent", type: "folder", children: ["agent.ts", "instructions.md"] },
  { name: "package.json", type: "file" },
  { name: "README.md", type: "file" },
];

const code = [
  'import { defineAgent } from "eve";',
  "",
  "export default defineAgent({",
  '  model: "openai/gpt-5.1-codex-max",',
  "  tools: {",
  "    repository: true,",
  "    terminal: true,",
  "    review: true,",
  "  },",
  "});",
];

export function AgentIDE() {
  const [activeFile, setActiveFile] = useState("agent.ts");
  const [activeTab, setActiveTab] = useState<"editor" | "diff">("editor");
  const [panel, setPanel] = useState<"review" | "chat" | "problems">("review");
  const [buildState, setBuildState] = useState<"idle" | "running" | "passed">("idle");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ app: true, agent: true });

  const statusText = useMemo(() => {
    if (buildState === "running") return "Building workspace…";
    if (buildState === "passed") return "Build passed";
    return "Ready";
  }, [buildState]);

  function runBuild() {
    setBuildState("running");
    window.setTimeout(() => setBuildState("passed"), 1200);
  }

  return (
    <main className="flex h-dvh min-w-0 flex-col overflow-hidden bg-[#0b0d10] text-zinc-100">
      <header className="flex h-12 shrink-0 items-center border-b border-white/10 bg-[#0f1115] px-3 text-sm">
        <div className="flex items-center gap-2 pr-4 font-semibold tracking-tight">
          <div className="grid size-6 place-items-center rounded-md bg-white text-black">
            <Code2Icon className="size-4" />
          </div>
          Zvelclaw
          <span className="text-zinc-500">IDE</span>
        </div>
        <div className="mx-2 h-5 w-px bg-white/10" />
        <button className="flex items-center gap-1 rounded-md px-2 py-1.5 text-zinc-300 hover:bg-white/5">
          zvelclaw-agent <ChevronDownIcon className="size-3.5" />
        </button>
        <button className="ml-2 flex items-center gap-1 rounded-md px-2 py-1.5 text-zinc-400 hover:bg-white/5">
          <GitBranchIcon className="size-3.5" /> main
        </button>
        <div className="ml-auto flex items-center gap-1">
          <ToolbarButton icon={<WrenchIcon />} label="Build" onClick={runBuild} />
          <ToolbarButton icon={<SparklesIcon />} label="Review" onClick={() => setPanel("review")} />
          <ToolbarButton icon={<BotIcon />} label="Fix" onClick={() => setPanel("chat")} />
          <button onClick={runBuild} className="ml-1 flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 font-medium text-black hover:bg-zinc-200">
            <PlayIcon className="size-3.5 fill-current" /> Run
          </button>
          <button className="ml-1 grid size-8 place-items-center rounded-md text-zinc-400 hover:bg-white/5" aria-label="Settings">
            <Settings2Icon className="size-4" />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-white/10 bg-[#0d0f13] md:block">
          <div className="flex h-10 items-center justify-between border-b border-white/10 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Explorer
            <PlusIcon className="size-3.5" />
          </div>
          <div className="p-2 text-[13px]">
            <div className="mb-2 flex items-center gap-2 px-2 text-zinc-500"><SearchIcon className="size-3.5" /> Search files</div>
            {files.map((file) => file.type === "folder" ? (
              <div key={file.name}>
                <button onClick={() => setExpanded((v) => ({ ...v, [file.name]: !v[file.name] }))} className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-zinc-300 hover:bg-white/5">
                  {expanded[file.name] ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
                  <FolderIcon className="size-3.5" /> {file.name}
                </button>
                {expanded[file.name] && <div className="ml-5 border-l border-white/10 pl-1">
                  {file.children?.map((child) => <FileRow key={child} name={child} active={activeFile === child} onClick={() => setActiveFile(child)} />)}
                </div>}
              </div>
            ) : <FileRow key={file.name} name={file.name} active={activeFile === file.name} onClick={() => setActiveFile(file.name)} />)}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-[#0b0d10]">
          <div className="flex h-10 shrink-0 items-center border-b border-white/10 bg-[#101217]">
            <button onClick={() => setActiveTab("editor")} className={cn("flex h-full items-center gap-2 border-r border-white/10 px-3 text-xs", activeTab === "editor" ? "bg-[#0b0d10] text-white" : "text-zinc-500")}>
              <FileCode2Icon className="size-3.5" /> {activeFile} <XIcon className="size-3 text-zinc-600" />
            </button>
            <button onClick={() => setActiveTab("diff")} className={cn("flex h-full items-center gap-2 border-r border-white/10 px-3 text-xs", activeTab === "diff" ? "bg-[#0b0d10] text-white" : "text-zinc-500")}>
              Diff
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto font-mono text-[13px] leading-6">
            {activeTab === "editor" ? <div className="min-w-[620px] p-4">
              {code.map((line, index) => <div key={`${index}-${line}`} className="flex min-h-6">
                <span className="w-10 shrink-0 select-none pr-4 text-right text-zinc-700">{index + 1}</span>
                <span className="whitespace-pre text-zinc-300">{line || " "}</span>
              </div>)}
              <div className="mt-4 rounded-md border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">
                <span className="font-semibold">AI suggestion:</span> add explicit tool permissions before enabling terminal access.
              </div>
            </div> : <DiffView />}
          </div>

          <div className="border-t border-white/10 bg-[#0d0f13]">
            <div className="flex h-9 items-center gap-4 px-3 text-[11px]">
              <button className={cn("flex items-center gap-1.5", panel === "problems" ? "text-white" : "text-zinc-500")} onClick={() => setPanel("problems")}><AlertTriangleIcon className="size-3.5" /> Problems <span className="rounded bg-red-500/15 px-1.5 text-red-300">1</span></button>
              <button className="flex items-center gap-1.5 text-zinc-500"><TerminalIcon className="size-3.5" /> Terminal</button>
              <button className="flex items-center gap-1.5 text-zinc-500"><TestTube2Icon className="size-3.5" /> Tests</button>
              <span className="ml-auto text-zinc-500">{statusText}</span>
            </div>
            <div className="h-20 overflow-auto border-t border-white/5 px-3 py-2 font-mono text-[11px] text-zinc-500">
              <div>$ pnpm typecheck</div>
              {buildState === "running" ? <div className="text-zinc-300">Checking project…</div> : buildState === "passed" ? <div className="text-emerald-400">✓ Typecheck completed successfully</div> : <div>Waiting for a build command…</div>}
            </div>
          </div>
        </section>

        <aside className="hidden w-80 shrink-0 border-l border-white/10 bg-[#0d0f13] lg:flex lg:flex-col">
          <div className="flex h-10 items-center border-b border-white/10 px-3">
            <div className="flex gap-1 text-xs">
              <PanelTab active={panel === "review"} onClick={() => setPanel("review")}>AI Review</PanelTab>
              <PanelTab active={panel === "chat"} onClick={() => setPanel("chat")}>Agent</PanelTab>
              <PanelTab active={panel === "problems"} onClick={() => setPanel("problems")}>Problems</PanelTab>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            {panel === "review" && <ReviewPanel />}
            {panel === "chat" && <AgentPanel />}
            {panel === "problems" && <ProblemsPanel />}
          </div>
        </aside>
      </div>

      <footer className="flex h-6 shrink-0 items-center justify-between border-t border-white/10 bg-[#0a0c0f] px-3 text-[10px] text-zinc-500">
        <div className="flex gap-4"><span>main</span><span>0 changes</span><span>UTF-8</span><span>TypeScript</span></div>
        <div className="flex items-center gap-1.5"><CircleDotIcon className="size-3 text-emerald-400" /> Zvelclaw Agent ready</div>
      </footer>
    </main>
  );
}

function ToolbarButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-white/5 hover:text-white sm:flex">{icon}<span>{label}</span></button>;
}

function FileRow({ name, active, onClick }: { name: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={cn("flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left", active ? "bg-white/8 text-white" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300")}><FileCode2Icon className="size-3.5" /> {name}</button>;
}

function PanelTab({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className={cn("rounded px-2 py-1", active ? "bg-white/8 text-white" : "text-zinc-500 hover:text-zinc-300")}>{children}</button>;
}

function ReviewPanel() {
  return <div className="space-y-3">
    <div><div className="text-sm font-medium">Code review</div><div className="mt-1 text-xs text-zinc-500">Workspace analysis against main</div></div>
    <ReviewItem tone="good" title="Architecture" text="Agent boundary is clear." />
    <ReviewItem tone="good" title="Type safety" text="No obvious type violations." />
    <ReviewItem tone="warn" title="Tool permissions" text="Terminal access should be explicitly scoped." />
    <ReviewItem tone="bad" title="Validation" text="Review must run after every generated patch." />
    <button className="w-full rounded-md bg-white px-3 py-2 text-xs font-medium text-black hover:bg-zinc-200">Fix all findings</button>
  </div>;
}

function ReviewItem({ tone, title, text }: { tone: "good" | "warn" | "bad"; title: string; text: string }) {
  const Icon = tone === "good" ? CheckCircle2Icon : tone === "warn" ? AlertTriangleIcon : XIcon;
  return <div className="rounded-md border border-white/8 bg-white/[0.02] p-3"><div className="flex items-center gap-2 text-xs font-medium"><Icon className={cn("size-4", tone === "good" ? "text-emerald-400" : tone === "warn" ? "text-amber-400" : "text-red-400")} />{title}</div><p className="mt-1.5 text-[11px] leading-5 text-zinc-500">{text}</p></div>;
}

function AgentPanel() {
  return <div className="flex h-full flex-col"><div className="flex-1 space-y-4 text-xs leading-5"><div className="rounded-md bg-white/[0.03] p-3 text-zinc-400">I can inspect the repository, modify files, run validation, review the diff, and iterate until the build passes.</div><div className="rounded-md bg-white/[0.03] p-3 text-zinc-300">What should I change?</div></div><div className="rounded-md border border-white/10 bg-white/[0.02] p-2 text-xs text-zinc-600">Ask Zvelclaw to build or fix…</div></div>;
}

function ProblemsPanel() {
  return <div className="space-y-2 text-xs"><div className="rounded-md border border-red-400/20 bg-red-400/5 p-3"><div className="font-medium text-red-300">1 issue</div><div className="mt-1 text-zinc-500">Review loop is not yet connected to the build executor.</div></div><div className="text-zinc-600">Run Build after applying a patch.</div></div>;
}

function DiffView() {
  return <div className="min-w-[620px] font-mono text-[12px] leading-6"><div className="bg-red-500/5 px-4 text-red-300">- model: "openai/gpt-5.1-codex-max",</div><div className="bg-emerald-500/5 px-4 text-emerald-300">+ model: "openai/gpt-5.1-codex-max",</div><div className="bg-emerald-500/5 px-4 text-emerald-300">+ tools: {"{ repository: true, terminal: true }"}</div></div>;
}
