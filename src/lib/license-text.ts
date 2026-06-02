// Proprietary license text — single source of truth for the `/license` page.
//
// Kept in sync MANUALLY with the repo-root `LICENSE` file (they hold the same
// wording). Inlining the body as a constant avoids reading from disk via `fs`
// at render time and keeps the text out of any client bundle concerns; the
// `/license` route imports `LICENSE_TEXT` and renders it as prose.

export const LICENSE_TITLE = "PROPRIETARY SOFTWARE LICENSE" as const;

export const LICENSE_COPYRIGHT =
  "Copyright © 2026 One Thousand Drones. All rights reserved." as const;

/**
 * The body paragraphs of the all-rights-reserved license, in order. Rendered as
 * a stack of paragraphs by the `/license` page; joined with blank lines for the
 * plain-text `LICENSE` file.
 */
export const LICENSE_BODY = [
  "This software and its accompanying source code, documentation, and assets (the “Software”) are the proprietary and confidential property of One Thousand Drones.",
  "No part of the Software may be reproduced, copied, modified, adapted, published, distributed, sublicensed, sold, or used, in whole or in part, by any means or in any form, without the express prior written permission of One Thousand Drones.",
  "Unauthorized use, reproduction, or distribution of the Software, or any portion of it, is strictly prohibited and may result in civil and criminal penalties.",
  "THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NONINFRINGEMENT.",
] as const;
