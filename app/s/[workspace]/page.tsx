import { AgentIDE } from "../../_components/agent-ide";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  await params;
  return <AgentIDE />;
}
