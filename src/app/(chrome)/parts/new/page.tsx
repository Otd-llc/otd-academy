// /parts/new — full-page Part create form (also reachable as a modal
// from the BomLine editor on the revision detail per design §9 routes).
import { NewPartForm } from "./_form";
import { PageHeader } from "@/components/PageHeader";

export default function NewPartPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        backHref="/parts"
        backLabel="Parts library"
        eyebrow="PARTS LIBRARY"
        title="New part"
        accentWord="part"
        lead="Parts library is global — these rows are reused across projects."
      />

      <div className="mt-8 glass-card p-4 sm:p-6">
        <NewPartForm />
      </div>
    </main>
  );
}
