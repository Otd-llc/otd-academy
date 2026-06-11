"use client";

// The learner's stage gate — ONE place that lists every requirement to clear the
// current stage with a live ✓/○ status, opens a brand-colored upload modal
// preloaded for the required artifact, and offers the advance button. Replaces
// the old split where the proof block + advance lived inline and the quiz status
// was only implied. Driven entirely by props the server resolves from the gate
// spec (gate-spec.ts) × the learner's enrollment state.
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ProofUploadForm } from "./ProofUploadForm";
import { AdvanceEnrollmentButton } from "./AdvanceEnrollmentButton";

export interface GateArtifactProps {
  /** Short label, e.g. "clean ERC report". */
  label: string;
  /** File-input accept filter, e.g. ".rpt,.txt". */
  accept: string;
  /** Plain-words statement of what to upload. */
  requirement: string;
  /** Collapsible how-to summary line. */
  howToTitle: string;
  /** Ordered steps to produce the artifact. */
  steps: string[];
  /** Whether the learner already has a PASSING proof on file. */
  onFile: boolean;
  /** Uploads are content-validated (e.g. ERC) — hides the paste-a-link option. */
  requiresValidation: boolean;
  /** When not yet on file, why the last upload failed its check (or null). */
  invalidDetail: string | null;
  /** Self-attestation statements the learner must tick before uploading — checks
   *  the validator can't see (e.g. the antenna keep-out). Empty/absent = none. */
  confirm?: string[];
}

function Row({
  met,
  children,
}: {
  met: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 rounded border border-panel-border bg-deep-space/40 p-3">
      <span
        aria-hidden
        className={`mt-0.5 font-mono text-sm ${met ? "text-status-green" : "text-muted"}`}
      >
        {met ? "✓" : "○"}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}

export function LearnerGate({
  projectId,
  stage,
  cardBaseHref,
  guideStages,
  quizRequired,
  quizPassed,
  cardHasQuiz,
  artifact,
}: {
  projectId: string;
  stage: string;
  cardBaseHref: string;
  guideStages: readonly string[];
  quizRequired: boolean;
  quizPassed: boolean;
  /** Whether this stage's card actually renders a quiz the learner can take. */
  cardHasQuiz: boolean;
  artifact: GateArtifactProps | null;
}) {
  const [open, setOpen] = useState(false);
  const confirmItems = artifact?.confirm ?? [];
  const [confirmed, setConfirmed] = useState<Set<number>>(() => new Set());
  const allConfirmed = confirmItems.every((_, i) => confirmed.has(i));

  return (
    <section className="mt-8 glass-card border-l-4 border-l-command-gold p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-command-gold">
        Your track · this is your current stage
      </p>
      <p className="mb-4 mt-1 font-serif text-sm text-gray-1">
        Clear every requirement below to advance your own progress.
      </p>

      <ul className="space-y-2">
        {quizRequired && (
          <Row met={quizPassed}>
            {quizPassed ? (
              <p className="font-mono text-xs uppercase tracking-wider text-status-green">
                Comprehension check passed
              </p>
            ) : (
              <>
                <p className="font-mono text-[11px] uppercase tracking-wider text-command-gold">
                  Required · comprehension check
                </p>
                <p className="mt-1 font-serif text-sm text-gray-1">
                  {cardHasQuiz
                    ? "Take the comprehension check on this card above to satisfy this requirement."
                    : "A comprehension check for this stage is coming soon."}
                </p>
              </>
            )}
          </Row>
        )}

        {artifact && (
          <Row met={artifact.onFile}>
            {artifact.onFile ? (
              <p className="font-mono text-xs uppercase tracking-wider text-status-green">
                Your {artifact.label} is on file
              </p>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-command-gold">
                    Required · {artifact.label}
                  </p>
                  <p className="mt-1 font-serif text-sm text-gray-1">
                    {artifact.requirement}
                  </p>
                  {artifact.invalidDetail && (
                    <p className="mt-1.5 font-mono text-[11px] uppercase tracking-wider text-alert-red">
                      Last upload wasn&apos;t clean · found {artifact.invalidDetail}
                    </p>
                  )}
                </div>
                <Dialog.Root
                  open={open}
                  onOpenChange={(o) => {
                    setOpen(o);
                    if (!o) setConfirmed(new Set());
                  }}
                >
                  <Dialog.Trigger asChild>
                    <button
                      type="button"
                      className="inline-flex shrink-0 items-center gap-1.5 rounded border border-command-gold bg-navy-dark px-3 py-2 font-mono text-xs uppercase tracking-wider text-command-gold transition-colors hover:bg-command-gold hover:text-deep-space"
                    >
                      Upload {artifact.label}
                    </button>
                  </Dialog.Trigger>
                  <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-40 bg-deep-space/80 backdrop-blur-sm" />
                    <Dialog.Content className="glass-card fixed left-1/2 top-1/2 z-50 w-[min(92vw,34rem)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-panel-border p-6">
                      <div className="flex items-start justify-between gap-4">
                        <Dialog.Title className="font-display text-xl uppercase tracking-wide text-command-gold">
                          Upload your {artifact.label}
                        </Dialog.Title>
                        <Dialog.Close
                          aria-label="Close"
                          className="shrink-0 rounded border border-panel-border px-2 py-0.5 font-mono text-sm text-muted transition-colors hover:border-command-gold hover:text-command-gold"
                        >
                          ✕
                        </Dialog.Close>
                      </div>
                      <Dialog.Description className="mt-2 font-serif text-sm text-gray-1">
                        {artifact.requirement}
                      </Dialog.Description>

                      <details className="mt-3">
                        <summary className="cursor-pointer select-none font-mono text-[11px] uppercase tracking-wider text-link-muted transition-colors hover:text-command-gold">
                          {artifact.howToTitle}
                        </summary>
                        <ol className="mt-2 list-decimal space-y-1.5 pl-5 font-serif text-sm text-gray-2">
                          {artifact.steps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      </details>

                      {confirmItems.length > 0 && (
                        <fieldset className="mt-4 space-y-2 rounded border border-panel-border bg-deep-space/40 p-3">
                          <legend className="px-1 font-mono text-[11px] uppercase tracking-wider text-command-gold">
                            Confirm before you upload
                          </legend>
                          <p className="font-serif text-xs text-muted">
                            The rules checker can&apos;t see these — tick each only
                            if it&apos;s true of your board.
                          </p>
                          {confirmItems.map((item, i) => (
                            <label
                              key={i}
                              className="flex cursor-pointer items-start gap-2.5 font-serif text-sm text-gray-1"
                            >
                              <input
                                type="checkbox"
                                checked={confirmed.has(i)}
                                onChange={(e) =>
                                  setConfirmed((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(i);
                                    else next.delete(i);
                                    return next;
                                  })
                                }
                                className="mt-1 shrink-0 accent-command-gold"
                              />
                              <span>{item}</span>
                            </label>
                          ))}
                        </fieldset>
                      )}

                      <div className="mt-5 border-t border-panel-border pt-4">
                        <ProofUploadForm
                          projectId={projectId}
                          stage={stage}
                          label={artifact.label}
                          accept={artifact.accept}
                          allowLink={!artifact.requiresValidation}
                          disabled={!allConfirmed}
                          onUploaded={() => setOpen(false)}
                        />
                      </div>
                    </Dialog.Content>
                  </Dialog.Portal>
                </Dialog.Root>
              </div>
            )}
          </Row>
        )}
      </ul>

      <div className="mt-4">
        <AdvanceEnrollmentButton
          projectId={projectId}
          cardBaseHref={cardBaseHref}
          guideStages={guideStages}
        />
      </div>
    </section>
  );
}
