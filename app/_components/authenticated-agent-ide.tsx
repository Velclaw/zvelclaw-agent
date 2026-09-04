import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { AgentIDE } from "./agent-ide";
import { AccountControl, SignIn } from "./web-chat-auth";

export async function AuthenticatedAgentIDE() {
  if (process.env.NODE_ENV === "development") {
    return <AgentIDE />;
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return <SignIn />;

  return (
    <>
      <AgentIDE />
      <AccountControl
        email={session.user.email}
        image={session.user.image}
        name={session.user.name}
      />
    </>
  );
}
