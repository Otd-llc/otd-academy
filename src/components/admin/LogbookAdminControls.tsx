"use client";

// Admin per-learner logbook controls (2026-07-13). A VISUAL patch grid — every
// grantable patch as its real badge; click to grant, click again to revoke (earned =
// full color, unearned = dim). Plus adjust XP (rank follows) and override the FL level.
// Thin client islands over the requireAdmin server actions; the server action
// revalidates the page so the grid reflects the new state.
import { useState, useTransition } from "react";
import {
  adminGrantPatch,
  adminRevokePatch,
  adminAdjustXp,
  adminSetLevel,
} from "@/lib/actions/admin-logbook";
import { PatchBadge } from "@/components/logbook/Patch";
import { RankWing } from "@/components/logbook/RankWing";
import {
  ROADMAP_PATCHES,
  HARDWARE_PATCHES,
  artForBadge,
  patchLabel,
  tierForBadge,
  type PatchArt,
} from "@/lib/logbook/patches";
import { LEVELS } from "@/lib/logbook/economy";

const METAL = ["Bronze", "Silver", "Gold"];
type Tile = { key: string; art: PatchArt; label: string; tier: number };

// The fixed grantable catalog: cluster + wings roadmap patches, the two skill patches,
// then the 5 hardware badges × 3 metal tiers. Course ratings are per-slug (dynamic) so
// they only appear under "Other earned" when the learner already holds one.
const STANDARD: Tile[] = [
  ...ROADMAP_PATCHES.map((p) => ({ key: p.key, art: artForBadge(p.key), label: p.label, tier: 0 })),
  { key: "skill:first-flight", art: artForBadge("skill:first-flight"), label: "First Flight", tier: 0 },
  { key: "skill:shipped-it", art: artForBadge("skill:shipped-it"), label: "Shipped It", tier: 0 },
];
const HARDWARE: Tile[] = HARDWARE_PATCHES.flatMap((h) =>
  [1, 2, 3].map((t) => ({ key: `${h.key}:${t}`, art: h.art, label: `${h.label} · ${METAL[t - 1]}`, tier: t - 1 })),
);
const CATALOG_KEYS = new Set([...STANDARD, ...HARDWARE].map((t) => t.key));

const INPUT =
  "w-full border-0 border-b border-panel-border bg-transparent px-0 py-1.5 font-mono text-xs text-text focus:border-command-gold focus:outline-none";
const BTN =
  "shrink-0 rounded border border-command-gold px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space disabled:opacity-40";

export function LogbookAdminControls({
  userId,
  xpTotal,
  level,
  earnedKeys,
}: {
  userId: string;
  xpTotal: number;
  level: number;
  earnedKeys: string[];
}) {
  const [pending, start] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pendingLevel, setPendingLevel] = useState<number | null>(null);
  const [xp, setXp] = useState("");
  const [xpNote, setXpNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const earned = new Set(earnedKeys);
  const extras: Tile[] = earnedKeys
    .filter((k) => !CATALOG_KEYS.has(k))
    .map((k) => ({ key: k, art: artForBadge(k), label: patchLabel(k), tier: k.startsWith("hw:") ? tierForBadge(k) : 0 }));

  const toggle = (key: string, on: boolean) =>
    start(async () => {
      setMsg(null);
      setPendingKey(key);
      const res = on ? await adminRevokePatch({ userId, badgeKey: key }) : await adminGrantPatch({ userId, badgeKey: key });
      setMsg(res.ok ? { ok: true, text: `${on ? "Revoked" : "Granted"} ${key}` } : { ok: false, text: res.error ?? "Failed." });
      setPendingKey(null);
    });

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) =>
    start(async () => {
      setMsg(null);
      const res = await fn();
      setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error ?? "Failed." });
    });

  const setLevelTo = (target: number) => {
    setPendingLevel(target);
    start(async () => {
      setMsg(null);
      const res = await adminSetLevel({ userId, level: target });
      setMsg(res.ok ? { ok: true, text: `Set FL${target}` } : { ok: false, text: res.error ?? "Failed." });
      setPendingLevel(null);
    });
  };

  function Grid({ tiles }: { tiles: Tile[] }) {
    return (
      <div className="mt-2 grid grid-cols-4 gap-1 sm:grid-cols-6">
        {tiles.map((t) => {
          const on = earned.has(t.key);
          const busy = pendingKey === t.key && pending;
          return (
            <button
              key={t.key}
              type="button"
              disabled={pending}
              onClick={() => toggle(t.key, on)}
              title={`${t.key} — click to ${on ? "revoke" : "grant"}`}
              className="flex flex-col items-center gap-1 rounded p-2 text-center transition-colors hover:bg-command-gold/[0.06] disabled:opacity-60"
            >
              <PatchBadge art={t.art} earned={on} tier={t.tier} size={46} />
              <span className={`font-mono text-[8px] uppercase leading-tight tracking-[0.08em] ${on ? "text-gold-light" : "text-muted"}`}>
                {t.label}
              </span>
              <span className="font-mono text-[7px] uppercase tracking-[0.12em] text-gray-3">
                {busy ? "…" : on ? "granted" : "grant"}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Patches <span className="text-gray-3">· click to grant, click again to revoke</span>
        </p>

        <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.2em] text-command-gold">Cluster &amp; skill</p>
        <Grid tiles={STANDARD} />

        <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.2em] text-command-gold">Hardware · bronze / silver / gold</p>
        <Grid tiles={HARDWARE} />

        {extras.length > 0 ? (
          <>
            <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.2em] text-gray-3">Other earned</p>
            <Grid tiles={extras} />
          </>
        ) : null}
      </div>

      {/* Adjust XP */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Adjust XP <span className="text-gray-3">· current {xpTotal.toLocaleString("en-US")} · rank follows</span>
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <input className={`${INPUT} max-w-[120px]`} inputMode="numeric" placeholder="+/- amount" value={xp} onChange={(e) => setXp(e.target.value)} />
          <input className={`${INPUT} min-w-[140px] flex-1`} placeholder="note (optional)" value={xpNote} onChange={(e) => setXpNote(e.target.value)} />
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

      {/* Set level (override) — click a rank wing */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Set FL level <span className="text-gray-3">· click a wing · override, does not change XP</span>
        </p>
        <div className="mt-2 grid grid-cols-4 gap-1 sm:grid-cols-6">
          {LEVELS.map((l) => {
            const on = l.level === level;
            const busy = pendingLevel === l.level && pending;
            return (
              <button
                key={l.level}
                type="button"
                disabled={pending || on}
                onClick={() => setLevelTo(l.level)}
                title={`FL${l.level} · ${l.title}`}
                className={`flex flex-col items-center gap-1 rounded p-2 text-center transition-colors disabled:opacity-70 ${on ? "bg-command-gold/[0.08]" : "hover:bg-command-gold/[0.06]"}`}
              >
                <RankWing level={l.level} size={40} />
                <span className={`font-mono text-[8px] uppercase tracking-[0.1em] ${on ? "text-gold-light" : "text-muted"}`}>FL{l.level}</span>
                <span className="max-w-full truncate font-mono text-[7px] uppercase tracking-[0.1em] text-gray-3">
                  {on ? "current" : busy ? "…" : l.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {msg ? (
        <p className={`font-mono text-[10px] uppercase tracking-[0.12em] ${msg.ok ? "text-status-green" : "text-alert-red"}`}>
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
