// Shared regex for git short/long hashes printed as PCB silkscreen and stored
// on Revision (schematic/layout commit) and Board (silkscreenHash).
// Format: optional leading 'g' (git-describe prefix), then 7-40 lowercase
// hex characters. Case-insensitive at the SQL CHECK level (`~*`) and the
// JS regex level (`/i`) so callers can store either case.
export const SILKSCREEN_HASH_RE = /^g?[0-9a-f]{7,40}$/i;
