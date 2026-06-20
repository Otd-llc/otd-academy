---
name: session-handoff
description: >-
  Wrap a work chunk so a FRESH session (or your future self) resumes cleanly. Use
  when ending or pausing work, switching to a new session, or the user says "hand
  this off", "wrap up", "save state", "pause here", "pick this up later", before a
  break, or after creating a design/plan to be executed later. Codifies the core
  fact: the next session reads MEMORY + the repo, NOT this chat — so durable state
  must live in committed artifacts + a canonical RESUME-STATE memory block, never in
  the conversation. Pairs with writing-plans/executing-plans and
  finishing-a-development-branch.
---

# Session Handoff

The next session boots with **MEMORY.md + the repo — never this conversation.** A handoff
is only as good as what you committed and what you wrote to memory. Chat prose is for the
human in the room; to the next agent it evaporates.

## The rule

**Durable handoff = committed + pushed artifacts + ONE canonical RESUME-STATE memory block.**
Everything else is supporting. If load-bearing state exists only in chat, the handoff failed.

## Do this (checklist — track with TodoWrite if more than a quick wrap)

1. **Commit + push the artifacts.** Code, docs, plans, scripts — the repo is the source of
   truth. **Push the branch** (don't leave work only local). Capture the branch + key commit
   SHAs for the memory block.
2. **Write/refresh the RESUME-STATE block** in the relevant memory file — ONE authoritative
   paragraph: *where we are · what's committed (branch / PR / SHA) · the single next action ·
   open decisions awaiting the user · gotchas.* Update it **in place** — don't scatter
   competing copies across memories. Convert relative dates to absolute.
3. **Index it.** Add/keep the one-line `MEMORY.md` pointer (with a hook) if the entry is new.
4. **Emit a short resume card** to the human (≤ 6 lines): branch · the doc/plan to open · the
   one next action · anything that needs their decision. A pointer, not a state dump.
5. **Verify durability before declaring done:** committed? pushed? memory refreshed? If you
   can't answer yes to all three, the handoff isn't finished (see verification-before-completion).

## Gotchas that silently break handoffs

- **Stranded on a feature branch.** Anything a future session needs *everywhere* — skills,
  shared tooling, conventions — belongs on **main**, not a parked feature branch, or it's
  invisible from other branches/worktrees. (Real lesson: a skill committed only on a board
  branch couldn't be used on any other branch until it was landed on main.)
- **Gitignored docs.** Some plan/strategy docs are gitignored → the doc edit is **local-only**
  and won't reach the next session. The **memory** must then carry the pointer *and* the
  load-bearing decisions, or they're lost.
- **Secrets.** Credentials live in `.env.local` (gitignored). Reference them in memory ("set
  `X` in `.env.local`") — never commit them.
- **Three-places redundancy.** The plan/design doc = the detail; the memory = the pointer +
  current position; the chat = a short card. Don't re-paste full state into all three — the
  memory block is the only one the next agent actually reads.

## Pairs with

- **writing-plans / executing-plans** — a plan doc IS the execution handoff (self-describing
  header). Hand off "execute this" by pointing at the plan file, not by re-explaining it.
- **finishing-a-development-branch** — for when the work is *done* (merge / PR / cleanup),
  not paused.
- The **memory instructions** in the system prompt — this skill is how you apply them at a
  work boundary.
