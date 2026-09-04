import { connect } from "@vercel/connect/eve";
import { defineMcpClientConnection } from "eve/connections";

export default defineMcpClientConnection({
  url: "https://huynhthuong.xyz/",
  description: "MCP server at huynhthuong.xyz.",
  auth: connect("huynhthuong.xyz/cerise-chair"),
});
