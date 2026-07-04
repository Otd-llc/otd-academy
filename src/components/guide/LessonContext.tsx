"use client";

// Lesson-scoped context so leaf client components (notably GlossaryTerm) can
// resolve an in-lesson link without every intermediate renderer prop-drilling
// it. The guide card page knows the lesson's base URL
// (`/projects/<slug>/<revLabel>/guide`); it wraps GuideBlocks' output in this
// provider, and a term whose glossary entry carries a `where.stage` pointer
// turns into a `<lessonBase>/<STAGE>` link.
//
// A thin CLIENT provider around SERVER-rendered children is the standard
// Next.js pattern (same shape as a theme provider): the server blocks pass
// through as `children`, and any client component inside them can read the
// context. Outside a lesson (dialogs, the /glossary page) there's no provider,
// so `useLessonBase()` returns null and the "where it lives" link is omitted —
// graceful, never a broken href.

import { createContext, useContext, type ReactNode } from "react";

const LessonBaseContext = createContext<string | null>(null);

export function LessonProvider({
  lessonBase,
  children,
}: {
  lessonBase: string | null;
  children: ReactNode;
}) {
  return (
    <LessonBaseContext.Provider value={lessonBase}>
      {children}
    </LessonBaseContext.Provider>
  );
}

/** The current lesson's guide base URL, or null when rendered outside a lesson. */
export function useLessonBase(): string | null {
  return useContext(LessonBaseContext);
}
