// Pure href resolution for skill-tree node cards. No DB, no React — maps a
// computed `SkillNode` + the viewer's session to the destination a click should
// go to (or `null` for a non-interactive card).
//
// Branch semantics mirror the funnel decisions in the plan / `public-access.ts`:
//   - done / available (signed-in)  → the learner workspace `/learn/<slug>`.
//   - locked-account (FREE + anon)  → straight to sign-in. `resolveLessonAccess`
//       returns `redirectSignIn` for FREE + no session anyway, so a FREE outline
//       link would just bounce here — skip the hop.
//   - preview (PUBLIC + anon) / locked-paywall (PREMIUM) / locked-prereq
//       → the project outline (card-0) guide hub, the same path `/courses` cards
//         build today: `/projects/<slug>/<publishedLabel>/guide`.
//   - coming-soon → no link (the card renders as a non-interactive <div>).

import type { SkillNode } from "@/lib/skill-tree-core";

// hrefForNode only needs to know whether the viewer is signed in.
export interface HrefViewer {
  signedIn: boolean;
}

// Build the project-outline guide href. Returns null defensively if the node
// is missing its published-revision label (shouldn't happen — every outline
// state implies a published project — but a null label can't form a valid URL).
function outlineHref(node: SkillNode): string | null {
  if (!node.publishedLabel) return null;
  return `/projects/${node.slug}/${encodeURIComponent(
    node.publishedLabel,
  )}/guide`;
}

/**
 * Resolve the click destination for a skill-tree node, or `null` when the card
 * should render non-interactively (coming-soon, or an outline state with no
 * published label).
 */
export function hrefForNode(node: SkillNode, viewer: HrefViewer): string | null {
  switch (node.state) {
    case "done":
    case "available":
      // Both imply a signed-in, actionable learner; go to the workspace.
      return viewer.signedIn ? `/learn/${node.slug}` : outlineHref(node);
    case "locked-account":
      // FREE + anon: link straight to sign-in (outline would bounce here).
      return "/sign-in?callbackUrl=/courses";
    case "preview":
    case "locked-paywall":
    case "locked-prereq":
      return outlineHref(node);
    case "coming-soon":
      return null;
    default:
      return null;
  }
}
