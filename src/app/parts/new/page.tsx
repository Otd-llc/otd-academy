// /parts/new — full-page Part create form (also reachable as a modal
// from the BomLine editor on the revision detail per design §9 routes).
import { NewPartForm } from "./_form";

export default function NewPartPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-5xl tracking-wider text-white">
        NEW PART
      </h1>
      <p className="mt-2 font-mono text-xs uppercase tracking-wider text-muted">
        Parts library is global — these rows are reused across projects.
      </p>

      <div className="mt-8 border border-panel-border bg-navy-dark p-6">
        <NewPartForm />
      </div>
    </main>
  );
}
