"use client";

// Revision net editor (design §4 / Task 3). The curate → verify surface for the
// revision's connectivity data (GROUND / POWER / SIGNAL nets + their nodes).
// Client island; mirrors AssetRow's gate-control structure over the Net
// form-wrappers in `nets-form.ts`.
//
// Per net row: name · class pill · VerifyBadge · its nodes (`refDes.pin`) each
// with a remove button · an add-node row (refDes + pin inputs + Add) · a
// delete-net button · the verify / unverify / flag IconButtons. Every gate +
// delete dispatch carries the loaded `updatedAt` as the optimistic-lock fence
// (exactly like AssetRow) so a stale row is rejected ("reload") rather than
// silently clobbered. A new net is created via the header create row.
//
// Rejections returned by the wrappers (the optimistic-lock conflict, the
// duplicate-name guard, the flagged-verify guard, a node-uniqueness P2002) are
// surfaced inline as a single row-scoped (or header-scoped) error string —
// mirrors how AssetRow surfaces `error`.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ZodError } from "zod";
import type { FactTrust, NetClass } from "@prisma/client";

import {
  addNetNodeForm,
  createNetForm,
  deleteNetForm,
  removeNetNodeForm,
  setNetTrustForm,
  type NetFormState,
} from "@/lib/actions/nets-form";
import { IconButton } from "@/components/IconButton";
import {
  CheckIcon,
  AlertTriangleIcon,
  CloseIcon,
  UndoIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/icons";
import { VerifyBadge } from "@/components/parts/VerifyBadge";
import { nodeLabel, canAddNode } from "@/components/nets/net-editor-logic";

// ─── Serialized DTOs (dates → ISO strings cross the server→client seam) ───────
export type SerializedNetNode = {
  id: string;
  refDes: string;
  pin: string;
};

export type SerializedNet = {
  id: string;
  name: string;
  netClass: NetClass;
  trust: FactTrust;
  /** Optimistic-lock fence — the `updatedAt` the page loaded for this row. */
  updatedAt: string;
  nodes: SerializedNetNode[];
};

// Pure helpers (`nodeLabel`, `canAddNode`) live in `./net-editor-logic` so the
// unit test imports them without this island's server graph; re-exported here
// for callers that already reach for NetEditor.

const NET_CLASS_TONE: Record<NetClass, string> = {
  GROUND: "border-panel-border bg-navy-dark text-link-muted",
  POWER: "border-command-gold bg-navy-dark text-command-gold",
  SIGNAL: "border-panel-border bg-navy-dark text-muted",
};

const inputClass =
  "w-full rounded border border-panel-border bg-deep-space/60 px-2 py-1 font-mono text-sm text-link-muted placeholder:text-muted focus:border-command-gold focus:outline-none";

// ─── One net row ──────────────────────────────────────────────────────────────
function NetRow({ net }: { net: SerializedNet }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [newRefDes, setNewRefDes] = useState("");
  const [newPin, setNewPin] = useState("");

  // Run a form-wrapper, refresh on success, surface `message` on a handled
  // rejection — the AssetRow dispatch shape.
  function run(
    wrapper: () => Promise<NetFormState>,
    onOk?: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      try {
        const r = await wrapper();
        if (r.ok) {
          onOk?.();
          router.refresh();
        } else {
          setError(r.message ?? "Action failed.");
        }
      } catch (err) {
        setError(
          err instanceof ZodError
            ? "Invalid request."
            : "Action failed — check your connection and try again.",
        );
      }
    });
  }

  // Gate dispatch carries the loaded `updatedAt` (optimistic-lock fence).
  function runGate(action: "verify" | "unverify" | "flag") {
    run(() =>
      setNetTrustForm({ id: net.id, updatedAt: net.updatedAt, action }),
    );
  }

  function runAddNode() {
    if (!canAddNode(newRefDes, newPin)) return;
    run(
      () =>
        addNetNodeForm({
          netId: net.id,
          refDes: newRefDes.trim(),
          pin: newPin.trim(),
        }),
      () => {
        setNewRefDes("");
        setNewPin("");
      },
    );
  }

  return (
    <li className="space-y-3 py-4 font-mono text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-base text-white">{net.name}</span>
          <span
            className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${NET_CLASS_TONE[net.netClass]}`}
          >
            {net.netClass}
          </span>
          <VerifyBadge trust={net.trust} />
        </div>

        <div className="flex items-center gap-1">
          {net.trust === "UNVERIFIED" ? (
            <IconButton
              type="button"
              hint="Verify"
              ariaLabel={`Verify net ${net.name}`}
              disabled={isPending}
              onClick={() => runGate("verify")}
            >
              <CheckIcon className="h-5 w-5" />
            </IconButton>
          ) : null}

          {net.trust === "VERIFIED" ? (
            <IconButton
              type="button"
              hint="Undo verify"
              ariaLabel={`Undo verify on net ${net.name}`}
              disabled={isPending}
              onClick={() => runGate("unverify")}
            >
              <UndoIcon className="h-5 w-5" />
            </IconButton>
          ) : null}

          {net.trust !== "FLAGGED" ? (
            <IconButton
              type="button"
              tone="danger"
              hint="Flag"
              ariaLabel={`Flag net ${net.name}`}
              disabled={isPending}
              onClick={() => runGate("flag")}
            >
              <AlertTriangleIcon className="h-5 w-5" />
            </IconButton>
          ) : (
            <IconButton
              type="button"
              hint="Clear flag"
              ariaLabel={`Clear flag on net ${net.name}`}
              disabled={isPending}
              onClick={() => runGate("unverify")}
            >
              <CloseIcon className="h-5 w-5" />
            </IconButton>
          )}

          {/* Delete net — two-step inline confirm (mirrors AssetRow). A delete
              cascades the net's nodes via the schema relation; the deliberate
              confirm is the safeguard. */}
          {confirmingDelete ? (
            <>
              <IconButton
                type="button"
                tone="danger"
                hint="Confirm delete"
                ariaLabel={`Confirm delete net ${net.name}`}
                disabled={isPending}
                onClick={() =>
                  run(() => deleteNetForm({ id: net.id }), () =>
                    setConfirmingDelete(false),
                  )
                }
              >
                <span className="text-alert-red">
                  <CheckIcon className="h-5 w-5" />
                </span>
              </IconButton>
              <IconButton
                type="button"
                hint="Keep"
                ariaLabel={`Cancel delete net ${net.name}`}
                disabled={isPending}
                onClick={() => {
                  setConfirmingDelete(false);
                  setError(null);
                }}
              >
                <CloseIcon className="h-5 w-5" />
              </IconButton>
            </>
          ) : (
            <IconButton
              type="button"
              tone="danger"
              hint="Delete net"
              ariaLabel={`Delete net ${net.name}`}
              disabled={isPending}
              onClick={() => setConfirmingDelete(true)}
            >
              <TrashIcon className="h-5 w-5" />
            </IconButton>
          )}
        </div>
      </div>

      {/* Nodes — `refDes.pin` chips, each with a remove control. */}
      <div className="flex flex-wrap items-center gap-2">
        {net.nodes.length === 0 ? (
          <span className="font-mono text-xs uppercase tracking-wider text-muted">
            No nodes
          </span>
        ) : (
          net.nodes.map((node) => (
            <span
              key={node.id}
              className="inline-flex items-center gap-1 rounded border border-panel-border bg-navy-dark px-2 py-0.5 text-link-muted"
            >
              {nodeLabel(node.refDes, node.pin)}
              <IconButton
                type="button"
                tone="danger"
                hint="Remove node"
                ariaLabel={`Remove node ${nodeLabel(node.refDes, node.pin)} from net ${net.name}`}
                disabled={isPending}
                onClick={() => run(() => removeNetNodeForm({ id: node.id }))}
              >
                <CloseIcon className="h-4 w-4" />
              </IconButton>
            </span>
          ))
        )}
      </div>

      {/* Add-node row — refDes + pin inputs + Add. */}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-muted">
            refDes
          </label>
          <input
            type="text"
            value={newRefDes}
            onChange={(e) => setNewRefDes(e.target.value)}
            placeholder="U1"
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-muted">
            pin
          </label>
          <input
            type="text"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            placeholder="3"
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <IconButton
          type="button"
          hint="Add node"
          ariaLabel={`Add node to net ${net.name}`}
          disabled={isPending || !canAddNode(newRefDes, newPin)}
          onClick={runAddNode}
        >
          <PlusIcon className="h-5 w-5" />
        </IconButton>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded border border-alert-red bg-navy-dark px-3 py-2 font-mono text-xs text-alert-red"
        >
          {error}
        </p>
      ) : null}
    </li>
  );
}

// ─── Create-net header row ────────────────────────────────────────────────────
function CreateNetRow({ revisionId }: { revisionId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [netClass, setNetClass] = useState<NetClass>("SIGNAL");

  function runCreate() {
    if (name.trim().length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        const r = await createNetForm({
          revisionId,
          name: name.trim(),
          netClass,
        });
        if (r.ok) {
          setName("");
          setNetClass("SIGNAL");
          router.refresh();
        } else {
          // A field-keyed Zod error (bad net name) OR a single message
          // (duplicate-name guard) — surface whichever came back.
          const fieldMsg = Object.values(r.errors ?? {})
            .flat()
            .join(" ");
          setError(r.message ?? (fieldMsg || "Could not create net."));
        }
      } catch (err) {
        setError(
          err instanceof ZodError
            ? "Invalid request."
            : "Could not create net — check your connection and try again.",
        );
      }
    });
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-muted">
            Net name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="+3V3"
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-muted">
            Class
          </label>
          <select
            value={netClass}
            onChange={(e) => setNetClass(e.target.value as NetClass)}
            className={`mt-1 ${inputClass}`}
          >
            <option value="GROUND">GROUND</option>
            <option value="POWER">POWER</option>
            <option value="SIGNAL">SIGNAL</option>
          </select>
        </div>
        <IconButton
          type="button"
          hint="Add net"
          ariaLabel="Add net"
          disabled={isPending || name.trim().length === 0}
          onClick={runCreate}
        >
          <PlusIcon className="h-5 w-5" />
        </IconButton>
      </div>
      {error ? (
        <p
          role="alert"
          className="rounded border border-alert-red bg-navy-dark px-3 py-2 font-mono text-xs text-alert-red"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ─── Pane ─────────────────────────────────────────────────────────────────────
export function NetEditor({
  revisionId,
  nets,
}: {
  revisionId: string;
  nets: SerializedNet[];
}) {
  return (
    <div>
      <CreateNetRow revisionId={revisionId} />

      {nets.length === 0 ? (
        <p className="mt-4 font-mono text-sm uppercase tracking-wider text-muted">
          NO NETS — ADD ONE ABOVE OR DERIVE RAILS FROM THE BOM.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-panel-border">
          {nets.map((net) => (
            <NetRow key={net.id} net={net} />
          ))}
        </ul>
      )}
    </div>
  );
}
