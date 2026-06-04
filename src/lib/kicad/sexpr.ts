// A tiny, robust KiCad S-expression parser + serializer (export-engine Task 4).
//
// KiCad's `.kicad_sym` / `.kicad_mod` / `*-lib-table` files are all
// S-expressions. The export engine ASSEMBLES uploaded assets rather than
// generating them from scratch, so it must PARSE an uploaded symbol/footprint,
// tweak one node (footprint association, 3D-model path), and RE-SERIALIZE it
// without disturbing the rest. That demands a real parser, not regex surgery.
//
// This module is PURE: no React, no DB, no env, no network, no fs. Target
// format is KiCad 10. Anchored to the real S-expression shapes exercised by
// `kicad-meta.test.ts`.
//
// ── SNode representation ───────────────────────────────────────────────────
// An S-expression node is one of three shapes, distinguished by `kind`:
//   - `{ kind: "sym", value }`  a BARE atom/symbol/number, emitted unquoted:
//                               `kicad_symbol_lib`, `yes`, `20211014`, `F.Cu`.
//   - `{ kind: "str", value }`  a DOUBLE-QUOTED string, always emitted quoted:
//                               `"AP2112K-3.3"`, `"My Part"`, `""`.
//   - `{ kind: "list", items }` a parenthesised list of child nodes.
// Keeping bare-vs-quoted explicit (rather than guessing on serialize) is what
// lets a round-trip be structurally stable: `parse(serialize(parse(x)))`
// equals `parse(x)`. KiCad itself quotes all property values and most strings
// but leaves keywords/enums/numbers bare, and the distinction is meaningful
// (a bare `yes` is a token; `"yes"` is a string value).

export type SAtomSym = { readonly kind: "sym"; readonly value: string };
export type SAtomStr = { readonly kind: "str"; readonly value: string };
export type SList = { readonly kind: "list"; readonly items: SNode[] };
export type SNode = SAtomSym | SAtomStr | SList;

// ── Constructors ───────────────────────────────────────────────────────────

/** A bare atom/symbol/number, emitted WITHOUT quotes (`yes`, `kicad_symbol_lib`). */
export function sym(value: string): SAtomSym {
  return { kind: "sym", value };
}

/** A double-quoted string value, ALWAYS emitted quoted (`"My Part"`, `""`). */
export function str(value: string): SAtomStr {
  return { kind: "str", value };
}

/** A parenthesised list. */
export function list(items: SNode[]): SList {
  return { kind: "list", items };
}

// ── Type guards ────────────────────────────────────────────────────────────

export function isList(node: SNode | undefined): node is SList {
  return node?.kind === "list";
}

export function isSym(node: SNode | undefined): node is SAtomSym {
  return node?.kind === "sym";
}

export function isStr(node: SNode | undefined): node is SAtomStr {
  return node?.kind === "str";
}

/** True for a bare symbol OR a quoted string (i.e. any non-list leaf). */
export function isAtom(node: SNode | undefined): node is SAtomSym | SAtomStr {
  return node?.kind === "sym" || node?.kind === "str";
}

/** The string content of any atom (bare or quoted); undefined for a list. */
export function atomValue(node: SNode | undefined): string | undefined {
  return isAtom(node) ? node.value : undefined;
}

/**
 * The head keyword of a list — the value of its first child IF that child is a
 * bare symbol (e.g. `property` for `(property "Footprint" ...)`). Returns
 * undefined for an empty list or one whose head is a string/list.
 */
export function head(node: SNode | undefined): string | undefined {
  if (!isList(node)) return undefined;
  const first = node.items[0];
  return isSym(first) ? first.value : undefined;
}

// ── Parser ─────────────────────────────────────────────────────────────────

/**
 * Parse a single top-level S-expression from `text`. Handles nested parens,
 * double-quoted strings with `\"` and `\\` escapes, bare atoms/numbers, and
 * arbitrary whitespace/newlines (including CRLF). Throws on malformed input
 * (unbalanced parens, unterminated string, trailing garbage).
 */
export function parseSexpr(text: string): SNode {
  const p = new Parser(text);
  p.skipWs();
  const node = p.parseNode();
  p.skipWs();
  if (!p.atEnd()) {
    throw new Error(
      `parseSexpr: unexpected trailing content at offset ${p.pos}`,
    );
  }
  return node;
}

class Parser {
  pos = 0;
  constructor(private readonly src: string) {}

  atEnd(): boolean {
    return this.pos >= this.src.length;
  }

  private peek(): string {
    return this.src[this.pos] ?? "";
  }

  skipWs(): void {
    while (this.pos < this.src.length) {
      const c = this.src[this.pos]!;
      // Whitespace: space, tab, CR, LF, form-feed.
      if (c === " " || c === "\t" || c === "\r" || c === "\n" || c === "\f") {
        this.pos++;
      } else {
        break;
      }
    }
  }

  parseNode(): SNode {
    const c = this.peek();
    if (c === "(") return this.parseList();
    if (c === '"') return this.parseString();
    if (c === ")") {
      throw new Error(`parseSexpr: unexpected ')' at offset ${this.pos}`);
    }
    if (c === "") {
      throw new Error("parseSexpr: unexpected end of input");
    }
    return this.parseBare();
  }

  private parseList(): SList {
    // consume '('
    this.pos++;
    const items: SNode[] = [];
    for (;;) {
      this.skipWs();
      const c = this.peek();
      if (c === ")") {
        this.pos++;
        return { kind: "list", items };
      }
      if (c === "") {
        throw new Error("parseSexpr: unterminated list (missing ')')");
      }
      items.push(this.parseNode());
    }
  }

  private parseString(): SAtomStr {
    // consume opening '"'
    this.pos++;
    let out = "";
    for (;;) {
      const c = this.src[this.pos];
      if (c === undefined) {
        throw new Error("parseSexpr: unterminated string");
      }
      if (c === "\\") {
        const next = this.src[this.pos + 1];
        if (next === undefined) {
          throw new Error("parseSexpr: dangling escape in string");
        }
        // KiCad escapes `\"` and `\\`; pass any other escape through verbatim
        // (e.g. `\n` stays a backslash-n token rather than a newline).
        if (next === '"' || next === "\\") {
          out += next;
        } else {
          out += "\\" + next;
        }
        this.pos += 2;
        continue;
      }
      if (c === '"') {
        this.pos++;
        return { kind: "str", value: out };
      }
      out += c;
      this.pos++;
    }
  }

  private parseBare(): SAtomSym {
    const start = this.pos;
    while (this.pos < this.src.length) {
      const c = this.src[this.pos]!;
      if (
        c === " " ||
        c === "\t" ||
        c === "\r" ||
        c === "\n" ||
        c === "\f" ||
        c === "(" ||
        c === ")" ||
        c === '"'
      ) {
        break;
      }
      this.pos++;
    }
    const value = this.src.slice(start, this.pos);
    if (value.length === 0) {
      throw new Error(`parseSexpr: empty atom at offset ${this.pos}`);
    }
    return { kind: "sym", value };
  }
}

// ── Serializer ─────────────────────────────────────────────────────────────

/** A bare atom never needs quoting; a `str` node always does. */
function needsQuoting(node: SAtomSym | SAtomStr): boolean {
  return node.kind === "str";
}

/** Escape `"` and `\` for emission inside a KiCad double-quoted string. */
export function escapeString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function serializeAtom(node: SAtomSym | SAtomStr): string {
  if (needsQuoting(node)) {
    return `"${escapeString(node.value)}"`;
  }
  return node.value;
}

/** A list whose every child is an atom (no nested lists) — e.g. `(xyz 0 0 0)`. */
function isLeafList(node: SList): boolean {
  return node.items.every((it) => it.kind !== "list");
}

/**
 * Whether a list should render inline on one line (no child newlines). KiCad's
 * pretty-printer keeps a node compact when it is shallow: a leaf-only list like
 * `(at 0 0 0)` / `(name "VIN" ...)`, OR a one-level wrapper whose every child is
 * an atom or a leaf-list — e.g. `(offset (xyz 0 0 0))`, `(effects (font (size
 * 1.27 1.27)))` collapse onto one line. A list that contains a child which is
 * itself a non-leaf list (e.g. `(model "p" (offset ...) (scale ...))`, or a
 * `(symbol ...)` / `(property ...)` carrying sub-lists) breaks its children
 * onto indented lines. This two-level rule reproduces real `.kicad_mod` /
 * `.kicad_sym` `(model ...)` formatting.
 */
function isInline(node: SList): boolean {
  return node.items.every((it) => it.kind !== "list" || isLeafList(it));
}

/**
 * Render an inline-eligible list on one line, space-separated. Atom children
 * serialize directly; leaf-list children (the only kind of list permitted here
 * per `isInline`) render as their own inline `(...)`.
 */
function serializeInline(node: SList): string {
  const parts = node.items.map((it) =>
    it.kind === "list" ? serializeInline(it) : serializeAtom(it),
  );
  return `(${parts.join(" ")})`;
}

/**
 * Serialize a node to KiCad-style text: nested lists are newline-indented (two
 * spaces per level), leaf-only lists stay inline, strings are quoted+escaped,
 * bare symbols stay bare. No trailing newline is appended (callers add one if a
 * file needs it). Round-trip stable with `parseSexpr`.
 */
export function serializeSexpr(node: SNode, indent = 0): string {
  if (node.kind !== "list") {
    return serializeAtom(node);
  }
  const pad = "  ".repeat(indent);
  if (node.items.length === 0) {
    return "()";
  }
  if (isInline(node)) {
    return serializeInline(node);
  }
  // Break: head on the opening line, each remaining child on its own indented
  // line. Atoms after the head stay on the head line (KiCad keeps e.g. the
  // symbol name on the `(symbol "Name"` line before the sub-lists begin).
  const childIndent = indent + 1;
  const childPad = "  ".repeat(childIndent);
  const parts: string[] = [];
  let i = 0;
  // Collect leading atoms (head + any atom args) onto the first line.
  const lead: string[] = [];
  while (i < node.items.length && node.items[i]!.kind !== "list") {
    lead.push(serializeAtom(node.items[i] as SAtomSym | SAtomStr));
    i++;
  }
  parts.push(`(${lead.join(" ")}`);
  // Remaining children (the first sub-list onward) each on their own line.
  for (; i < node.items.length; i++) {
    const child = node.items[i]!;
    if (child.kind === "list") {
      parts.push("\n" + childPad + serializeSexpr(child, childIndent));
    } else {
      // An atom appearing AFTER a sub-list — keep it on its own indented line
      // too so structure stays unambiguous.
      parts.push("\n" + childPad + serializeAtom(child as SAtomSym | SAtomStr));
    }
  }
  parts.push("\n" + pad + ")");
  return parts.join("");
}

// ── Child-node helpers (find / replace by head keyword) ────────────────────

/**
 * The FIRST direct child list of `node` whose head keyword === `keyword`
 * (e.g. `findChild(symbolNode, "property")` → the first `(property ...)`).
 * Returns undefined if `node` is not a list or no child matches.
 */
export function findChild(
  node: SNode | undefined,
  keyword: string,
): SList | undefined {
  if (!isList(node)) return undefined;
  for (const child of node.items) {
    if (isList(child) && head(child) === keyword) return child;
  }
  return undefined;
}

/** ALL direct child lists of `node` whose head keyword === `keyword`. */
export function findChildren(
  node: SNode | undefined,
  keyword: string,
): SList[] {
  if (!isList(node)) return [];
  return node.items.filter(
    (child): child is SList => isList(child) && head(child) === keyword,
  );
}

/**
 * The index of the first direct child list of `node` with head === `keyword`,
 * or -1. Useful for in-place insert/replace while preserving sibling order.
 */
export function findChildIndex(node: SList, keyword: string): number {
  return node.items.findIndex(
    (child) => isList(child) && head(child) === keyword,
  );
}
