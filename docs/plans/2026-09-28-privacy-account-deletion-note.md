# Account deletion and saved Hex builds: fact sheet for /privacy section 5

Owner's writing list, launch item 6.3 follow-up. This is a statement of what the code
does, for the owner to turn into the final `/privacy` section 5 wording. It is not legal
copy.

## The behaviour, in plain words

- When an account is deleted, every Hex build saved to that account is deleted with it:
  each build, every saved revision of it, and the share code of each revision.
- The build's public share page (`/c/<code>`, the page a printed sheet's QR code opens)
  stops showing the build. It shows the same generic "this build can't be opened" page
  as a code that never existed. It does not say the account was deleted.
- The deletion happens together with the account deletion, as one step: either the
  account and its builds are both deleted, or (if the account cannot be deleted) neither
  is.
- A cached copy of a share page is cleared at the same time, so the page stops showing
  the build straight away rather than after the one-hour cache window.
- Builds saved by other people are not affected, including builds that were made from
  a design the deleted user shared.
- Paper cannot be recalled: a sheet already printed or downloaded keeps whatever it
  shows. Only the online copy and its share page go.
- Drawing numbers of deleted builds are not reused.

## What is still kept after an account deletion (unchanged by this decision)

- Purchase records, with the link to the account removed (financial records).
- Certificates and tips, with the link to the account removed.

## Where it lives

`deleteStudent` in `src/lib/actions/admin-students.ts` (the only place the app deletes an
account). Tested in `src/lib/__tests__/admin-students-actions.test.ts`.

Note for older rows: if any account with saved builds was deleted before this change ships, its builds were kept with
the build name replaced by "(deleted)" and the share page shown without the "Open in the
configurator" button. Any such rows are not removed by this change.
