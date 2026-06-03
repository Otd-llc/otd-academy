// MCP tool handlers: compose the pure query layer (grounding + hard guards) with
// the formatter (answer contract + untrusted-data envelope). The client is
// INJECTED so the same handlers serve both the live read-only server (index.ts)
// and the integration tests (which inject the app `db`). Typed to `PartsQueryClient`
// — the read-only structural seam — so neither a write delegate nor src/lib/db.ts
// can sneak in.
import {
  lookupBom,
  lookupPart,
  type LookupBomArgs,
  type LookupPartArgs,
  type PartsQueryClient,
} from "../../src/lib/parts-knowledge/query";
import { formatBomResult, formatPartResult, type McpToolResult } from "./format";

export async function handleLookupPart(
  client: PartsQueryClient,
  args: LookupPartArgs,
): Promise<McpToolResult> {
  return formatPartResult(await lookupPart(client, args));
}

export async function handleLookupBom(
  client: PartsQueryClient,
  args: LookupBomArgs,
): Promise<McpToolResult> {
  return formatBomResult(await lookupBom(client, args));
}
