"use client";

// Admin per-learner logbook controls (2026-07-13). Grant/revoke any patch (incl. the
// tiered hardware keys), adjust XP (rank follows), and override the FL level. Thin
// client islands over the requireAdmin server actions; each shows an inline result.
import { useState, useTransition } from "react";
import {
  adminGrantPatch,
  adminRevokePatch,
  adminAdjustXp,
  adminSetLevel,
} from "@/lib/actions/admin-logbook";
import { HARDWARE_PATCHES } from "@/lib/logbook/patches";
import { LEVELS } from "@/lib/logbook/economy";

const METALS = ["bronze", "silver", "gold"];
// The 15 tiered hardware keys, for the quick-pick datalist.
const HW_KEYS = HARDWARE_PATCHES.flatMap((h) =>
  [1, 2, 3].map((t) => ({ key: `${h.key}:${t}`, label: `${h.label} · ${METALS[t - 1]}` })),
);

type Earned = { badgeKey: string; label: string };

const INPUT =
  "w-full border-0 border-b border-panel-border bg-transparent px-0 py-1.5 font-mono text-xs text-text focus:border-command-gold focus:outline-none";
const BTN =
  "shrink-0 rounded border border-command-gold px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-40";
const DANGER =
  "shrink-0 rounded border border-danger-coral/60 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-danger-coral transition-colors hover:bg-danger-coral hover:text-deep-space disabled:opacity-40";

function Msg({ m }: { m: { ok: boolean; text: string } | null }) {
  if (!m) return null;
  return (
    <p className={`mt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] ${m.ok ? "text-status-green" : "text-alert-red"}`}>
      {m.text}
    </p>
  );
}

export function LogbookAdminControls({
  userId,
  xpTotal,
  level,
  earned,
}: {
  userId: string;
  xpTotal: number;
  level: number;
  earned: Earned[];
}) {
  const [pending, start] = useTransition();
  const [grantKey, setGrantKey] = useState("");
  const [grantNote, setGrantNote] = useState("");
  const [xp, setXp] = useState("");
  const [xpNote, setXpNote] = useState("");
  const [lvl, setLvl] = useState(String(level));
  const [lvlNote, setLvlNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) =>
    start(async () => {
      setMsg(null);
      const res = await fn();
      setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error ?? "Failed." });
    });

  return (
    <div className="space-y-8">
      {/* Grant a patch */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Grant a patch</p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <input
              className={INPUT}
              list="hw-patch-keys"
              placeholder="badge key (e.g. hw:solder:2)"
              value={grantKey}
              onChange={(e) => setGrantKey(e.target.value)}
            />
            <datalist id="hw-patch-keys">
              {HW_KEYS.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.label}
                </option>
              ))}
            </datalist>
          </div>
          <input
            className={`${INPUT} min-w-[140px] flex-1`}
            placeholder="note (optional)"
            value={grantNote}
            onChange={(e) => setGrantNote(e.target.value)}
          />
          <button
            type="button"
            disabled={pending || !grantKey.trim()}
            className={BTN}
            onClick={() =>
              run(
                () => adminGrantPatch({ userId, badgeKey: grantKey.trim(), note: grantNote || undefined }),
                `Granted ${grantKey.trim()}`,
              )
            }
          >
            Grant
          </button>
        </div>
      </div>

      {/* Earned patches (revoke) */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Earned patches ({earned.length})
        </p>
        {earned.length === 0 ? (
          <p className="mt-2 font-mono text-xs text-muted">none</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {earned.map((e) => (
              <li key={e.badgeKey} className="flex items-center justify-between gap-3 border-b border-panel-border/50 pb-1.5">
                <span className="font-mono text-xs text-text">
                  {e.label} <span className="text-gray-3">· {e.badgeKey}</span>
                </span>
                <button
                  type="button"
                  disabled={pending}
                  className={DANGER}
                  onClick={() => {
                    setRevoking(e.badgeKey);
                    run(() => adminRevokePatch({ userId, badgeKey: e.badgeKey }), `Revoked ${e.badgeKey}`);
                  }}
                >
                  {revoking === e.badgeKey && pending ? "…" : "revoke"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Adjust XP */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Adjust XP <span className="text-gray-3">· current {xpTotal.toLocaleString("en-US")} · rank follows</span>
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <input
            className={`${INPUT} max-w-[120px]`}
            inputMode="numeric"
            placeholder="+/- amount"
            value={xp}
            onChange={(e) => setXp(e.target.value)}
          />
          <input
            className={`${INPUT} min-w-[140px] flex-1`}
            placeholder="note (optional)"
            value={xpNote}
            onChange={(e) => setXpNote(e.target.value)}
          />
          <button
            type="button"
            disabled={pending || !xp.trim() || Number.isNaN(Number(xp))}
            className={BTN}
            onClick={() => run(() => adminAdjustXp({ userId, amount: Number(xp), note: xpNote || undefined }), `Adjusted ${xp} XP`)}
          >
            Adjust
          </button>
        </div>
      </div>

      {/* Set level (override) */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Set FL level <span className="text-gray-3">· override, does not change XP</span>
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <select className={`${INPUT} max-w-[200px]`} value={lvl} onChange={(e) => setLvl(e.target.value)}>
            {LEVELS.map((l) => (
              <option key={l.level} value={l.level}>
                FL{l.level} · {l.title}
              </option>
            ))}
          </select>
          <input
            className={`${INPUT} min-w-[140px] flex-1`}
            placeholder="note (optional)"
            value={lvlNote}
            onChange={(e) => setLvlNote(e.target.value)}
          />
          <button
            type="button"
            disabled={pending || Number(lvl) === level}
            className={BTN}
            onClick={() => run(() => adminSetLevel({ userId, level: Number(lvl), note: lvlNote || undefined }), `Set FL${lvl}`)}
          >
            Set level
          </button>
        </div>
      </div>

      <Msg m={msg} />
    </div>
  );
}
