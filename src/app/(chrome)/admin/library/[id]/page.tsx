// Admin: create / edit one Library mini-lesson (Task A9). `id === "new"` is the
// create form; any other id loads that lesson for edit. The client
// MiniLessonEditor reuses the guide BlockListEditor for contentBlocks plus the
// mini-lesson header/SEO/relatedProjects inputs, wired to the mini-lesson actions.
//
// Admin-gated two ways: middleware (top === "admin") + `requireAdmin()` here.
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { guideContentBlocksSchema } from "@/lib/schemas/guide";
import { filterLibraryBlocks } from "@/lib/library/block-allowlist";
import {
  MiniLessonEditor,
  type RelatedProjectLink,
} from "@/components/library/MiniLessonEditor";
import { PageHeader } from "@/components/PageHeader";

type Params = { id: string };

export default async function MiniLessonAdminEditPage({
  params,
}: {
  params: Promise<Params>;
}) {
  await requireAdmin();
  const { id } = await params;
  const isCreate = id === "new";

  // Project options for the relatedProjects picker.
  const projects = await db.project.findMany({
    select: { slug: true, name: true, publicTitle: true },
    orderBy: { slug: "asc" },
  });
  const projectOptions = projects.map((p) => ({
    slug: p.slug,
    label: `${p.publicTitle ?? p.name} (${p.slug})`,
  }));

  if (isCreate) {
    return (
      <Shell heading="NEW">
        <MiniLessonEditor projectOptions={projectOptions} />
      </Shell>
    );
  }

  const lesson = await db.miniLesson.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      seoTitle: true,
      seoDescription: true,
      published: true,
      contentBlocks: true,
      relatedProjects: {
        orderBy: { ordinal: "asc" },
        select: {
          role: true,
          ordinal: true,
          project: { select: { slug: true } },
        },
      },
    },
  });
  if (!lesson) notFound();

  // Parse + allowlist-filter the stored blocks (defense-in-depth: a bad row
  // safeParses to [] and a project-coupled block is dropped before the editor
  // sees it). The save boundary re-rejects project-coupled blocks anyway.
  const parsed = guideContentBlocksSchema.safeParse(lesson.contentBlocks);
  const initialBlocks = filterLibraryBlocks(parsed.success ? parsed.data : []);

  const initialRelated: RelatedProjectLink[] = lesson.relatedProjects.map((r) => ({
    projectSlug: r.project.slug,
    role: r.role,
    ordinal: r.ordinal,
  }));

  return (
    <Shell heading={lesson.published ? "EDIT · PUBLISHED" : "EDIT · DRAFT"}>
      <MiniLessonEditor
        lessonId={lesson.id}
        published={lesson.published}
        initialSlug={lesson.slug}
        initialTitle={lesson.title}
        initialSummary={lesson.summary ?? ""}
        initialSeoTitle={lesson.seoTitle ?? ""}
        initialSeoDescription={lesson.seoDescription ?? ""}
        initialBlocks={initialBlocks}
        initialRelated={initialRelated}
        projectOptions={projectOptions}
      />
    </Shell>
  );
}

function Shell({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <PageHeader
        backHref="/admin/library"
        backLabel="Library authoring"
        eyebrow="MINI-LESSON"
        title={heading}
      />
      <div className="mt-8 rounded border-t-2 border-command-gold bg-navy-dark/20 p-4">
        {children}
      </div>
    </main>
  );
}
