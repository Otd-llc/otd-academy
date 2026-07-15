"use client";

// The signed-in follower card's diagram: the resume LESSON'S own hero diagram,
// whichever it is. Unlike the anon landing (which static-imports only the 2
// HERO_DIAGRAMS to keep its bundle lean), a student can be resuming any of ~60
// lessons, so this pulls the full DIAGRAM_COMPONENTS registry. It's loaded via
// next/dynamic from page.tsx, so the registry ships as a SEPARATE chunk fetched
// only when a signed-in student renders the card — the anonymous landing never
// requests it. Rendered bare (frame + graphic, no title/eyebrow/caption), since
// the card already shows the lesson title beside it.
import { DIAGRAM_COMPONENTS } from "@/components/guide/diagram-registry";
import { DiagramChromeProvider } from "@/components/guide/diagrams/DiagramChrome";

export default function ResumeDiagram({ src }: { src: string | null }) {
  const Comp = src ? DIAGRAM_COMPONENTS[src] : undefined;
  if (!Comp) return null;
  return (
    <DiagramChromeProvider bare fig={null}>
      <Comp />
    </DiagramChromeProvider>
  );
}
