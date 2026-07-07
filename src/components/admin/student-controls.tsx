"use client";

// Client controls for the admin student manager (/admin/students/[id]). Each
// calls a requireAdmin-gated action in @/lib/actions/admin-students. Kept in one
// file since they share the page and the same small form idioms. House style:
// hairline-grouped on deep-space, mono labels, gold actions, no em-dash.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateStudentProfile,
  grantProjectEntitlement,
  grantPassEntitlement,
  revokeEntitlement,
  resetEnrollment,
  deleteStudent,
} from "@/lib/actions/admin-students";
import { ONBOARDING_GOAL_OPTIONS } from "@/lib/onboarding-goals";

const INPUT =
  "w-full rounded border border-panel-border bg-deep-space px-3 py-2 font-mono text-sm text-text focus:border-command-gold focus:outline-none";
const BTN =
  "glass-button inline-flex items-center gap-1.5 px-4 py-2 font-mono text-xs uppercase tracking-wider disabled:opacity-50";
const DANGER =
  "inline-flex items-center gap-1.5 rounded border border-alert-red px-4 py-2 font-mono text-xs uppercase tracking-wider text-alert-red transition-colors hover:bg-alert-red hover:text-deep-space disabled:opacity-50";

function Note({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`font-mono text-[11px] uppercase tracking-wider ${ok ? "text-status-green" : "text-alert-red"}`}
    >
      {children}
    </span>
  );
}

// ─── Profile ────────────────────────────────────────────
export function StudentProfileForm({
  userId,
  initialName,
  initialConsent,
  initialGoal,
}: {
  userId: string;
  initialName: string | null;
  initialConsent: boolean;
  initialGoal: string | null;
}) {
  const [name, setName] = useState(initialName ?? "");
  const [consent, setConsent] = useState(initialConsent);
  const [goal, setGoal] = useState(initialGoal ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();

  function save() {
    start(async () => {
      setMsg(null);
      try {
        await updateStudentProfile({
          userId,
          name: name.trim() || null,
          emailConsent: consent,
          onboardingGoal: goal || null,
        });
        setMsg({ ok: true, text: "Saved" });
        router.refresh();
      } catch (e) {
        setMsg({
          ok: false,
          text: e instanceof Error ? e.message : "Could not save",
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
          Name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`mt-1 ${INPUT}`}
          placeholder="(none)"
        />
      </label>

      <label className="block">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
          Onboarding goal
        </span>
        <select
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          className={`mt-1 ${INPUT}`}
        >
          <option value="">(none)</option>
          {ONBOARDING_GOAL_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
          <option value="skipped">skipped</option>
        </select>
      </label>

      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="h-4 w-4 accent-command-gold"
        />
        <span className="font-serif text-sm text-text">
          Lifecycle-email consent (opted in)
        </span>
      </label>

      <div className="flex items-center gap-4">
        <button type="button" onClick={save} disabled={pending} className={BTN}>
          {pending ? "Saving…" : "Save profile"}
        </button>
        {msg && <Note ok={msg.ok}>{msg.text}</Note>}
      </div>
    </div>
  );
}

// ─── Access (entitlements) ──────────────────────────────
export function StudentAccess({
  userId,
  entitlements,
  grantableProjects,
  hasPass,
}: {
  userId: string;
  entitlements: { id: string; label: string; kind: "project" | "pass" }[];
  grantableProjects: { id: string; label: string }[];
  hasPass: boolean;
}) {
  const [projectId, setProjectId] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  function run(fn: () => Promise<unknown>) {
    start(async () => {
      setErr(null);
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Action failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      {entitlements.length === 0 ? (
        <p className="font-mono text-xs uppercase tracking-wider text-muted">
          No access grants. Only free boards are reachable.
        </p>
      ) : (
        <ul className="border-t border-panel-border/60">
          {entitlements.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 border-b border-panel-border/60 py-2.5"
            >
              <span className="font-serif text-sm text-text">
                {e.label}
                {e.kind === "pass" ? (
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.18em] text-command-gold">
                    pass
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => revokeEntitlement({ userId, entitlementId: e.id }))
                }
                className="font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-alert-red disabled:opacity-50"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-3 border-t border-panel-border/60 pt-4">
        <label className="flex-1">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
            Grant a board
          </span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className={`mt-1 ${INPUT}`}
          >
            <option value="">Select a board…</option>
            {grantableProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pending || !projectId}
          onClick={() =>
            run(async () => {
              await grantProjectEntitlement({ userId, projectId });
              setProjectId("");
            })
          }
          className={BTN}
        >
          Grant board
        </button>
        <button
          type="button"
          disabled={pending || hasPass}
          onClick={() => run(() => grantPassEntitlement({ userId }))}
          className={BTN}
        >
          {hasPass ? "Has pass" : "Grant All-Access Pass"}
        </button>
      </div>
      {err && <Note ok={false}>{err}</Note>}
    </div>
  );
}

// ─── Progress (enrollments) ─────────────────────────────
export function StudentProgress({
  userId,
  enrollments,
}: {
  userId: string;
  enrollments: {
    id: string;
    project: string;
    stage: string;
    status: string;
  }[];
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  function reset(enrollmentId: string, project: string) {
    if (
      !window.confirm(
        `Reset this learner's progress on "${project}"? This deletes the enrollment and its uploads. This cannot be undone.`,
      )
    ) {
      return;
    }
    start(async () => {
      setErr(null);
      try {
        await resetEnrollment({ userId, enrollmentId });
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not reset");
      }
    });
  }

  if (enrollments.length === 0) {
    return (
      <p className="font-mono text-xs uppercase tracking-wider text-muted">
        Not enrolled in any board.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="border-t border-panel-border/60">
        {enrollments.map((e) => (
          <li
            key={e.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-panel-border/60 py-2.5"
          >
            <span className="font-serif text-sm text-text">{e.project}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              {e.stage} · {e.status}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => reset(e.id, e.project)}
              className="font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-alert-red disabled:opacity-50"
            >
              Reset
            </button>
          </li>
        ))}
      </ul>
      {err && <Note ok={false}>{err}</Note>}
    </div>
  );
}

// ─── Delete ─────────────────────────────────────────────
export function DeleteStudentButton({
  userId,
  email,
  isSelf,
}: {
  userId: string;
  email: string;
  isSelf: boolean;
}) {
  const [arming, setArming] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  if (isSelf) {
    return (
      <p className="font-mono text-xs uppercase tracking-wider text-muted">
        You cannot delete your own account here.
      </p>
    );
  }

  function doDelete() {
    start(async () => {
      setErr(null);
      try {
        await deleteStudent({ userId });
        router.push("/admin/students");
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not delete");
      }
    });
  }

  if (!arming) {
    return (
      <button
        type="button"
        onClick={() => setArming(true)}
        className={DANGER}
      >
        Delete account
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="font-serif text-sm text-text">
        Type the email <span className="font-mono text-command-gold">{email}</span>{" "}
        to confirm permanent deletion.
      </p>
      <input
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder={email}
        className={`${INPUT} max-w-md`}
      />
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={pending || confirm.trim() !== email}
          onClick={doDelete}
          className={DANGER}
        >
          {pending ? "Deleting…" : "Permanently delete"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setArming(false);
            setConfirm("");
          }}
          className="font-mono text-[11px] uppercase tracking-wider text-muted hover:text-gold-light"
        >
          Cancel
        </button>
        {err && <Note ok={false}>{err}</Note>}
      </div>
    </div>
  );
}
