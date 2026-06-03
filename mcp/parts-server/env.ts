// Resolve the read-only DB URL for the parts MCP server.
//
// HARD ASSERTIONS (design §5): the var MUST be set and MUST differ from the
// owner DATABASE_URL — the MCP server must use the read-only role, NEVER the
// read-write owner client. Pure + injectable (takes an env object) so it is
// unit-testable without touching the real process env.
export function resolvePartsDbUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.PARTS_MCP_DATABASE_URL;
  if (!url) {
    throw new Error(
      "PARTS_MCP_DATABASE_URL is not set — the parts MCP server requires the read-only role URL.",
    );
  }
  if (url === env.DATABASE_URL) {
    throw new Error(
      "PARTS_MCP_DATABASE_URL must NOT equal DATABASE_URL — use the read-only role, never the owner.",
    );
  }
  return url;
}
