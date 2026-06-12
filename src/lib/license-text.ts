// License text — single source of truth for the `/license` page.
//
// Kept in sync MANUALLY with the repo-root `LICENSE.md` file (the canonical
// license; this constant renders the same terms as paragraph prose). Inlining
// the body avoids reading from disk via `fs` at render time; the `/license`
// route imports these and renders them.

export const LICENSE_TITLE =
  "All rights reserved — published for transparency and reference, not for use or reuse." as const;

export const LICENSE_COPYRIGHT =
  "Copyright © 2026 Joshua Tollette / One Thousand Drones LLC. All rights reserved." as const;

/**
 * The license terms as ordered paragraphs, mirroring `LICENSE.md`. Rendered as a
 * stack of paragraphs by the `/license` page.
 */
export const LICENSE_BODY = [
  "This source code is published publicly for transparency, reference, and portfolio purposes only. It is NOT licensed for use, copying, modification, distribution, or commercial use by any party other than the copyright holder without express prior written permission.",
  "You may: view the source code, and cite it in good-faith technical discussion or commentary, with attribution.",
  "You may not: copy any portion of this code into your own project (public or private); fork, modify, or redistribute it in any form, including derivative works; use it, in whole or in part, to operate any service or product; use the project’s name, branding, trademarks, or any associated identifiers in your own work; or train any machine learning model or AI system on this source code.",
  "For licensing inquiries, contact josh@onethousanddrones.com.",
] as const;
