"use client";

// A NAMED PART, so an effect can drive one element of a treatment rather than
// the whole assembly.
//
// Without this the entry stack could only fade a piece in as one object, and
// every treatment's internal choreography - the rule arriving, then the label,
// then the value - would collapse into a single dissolve. That choreography is
// exactly the thing the owner wants to dial, so it has to be addressable.
//
// The context carries the STACK and the clock, not pre-computed styles, because
// a part must stay a pure function of `t`: it asks for its own style at the
// moment it renders and gets the same answer every time for the same `t`.
//
// ASCII only.

import { createContext, useContext } from "react";
import { partStyle, drives, type EntryEffect, type EntryTarget } from "./entries";

type Ctx = { stack: EntryEffect[]; t: number } | null;
const EntryCtx = createContext<Ctx>(null);

export function EntryProvider({
  stack,
  t,
  children,
}: {
  stack: EntryEffect[];
  t: number;
  children: React.ReactNode;
}) {
  return <EntryCtx.Provider value={{ stack, t }}>{children}</EntryCtx.Provider>;
}

/**
 * Wrap a named part. If no effect targets it the wrapper is inert, so a
 * treatment can declare its parts before anybody dials them and nothing moves.
 */
export function Part({
  name,
  children,
  style,
}: {
  name: EntryTarget;
  /** Optional: a rule is a part with no contents, drawn by its own style. */
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const ctx = useContext(EntryCtx);
  const driven = ctx ? drives(ctx.stack, name) : false;
  const s = ctx && driven ? partStyle(ctx.stack, name, ctx.t) : {};
  return (
    <div data-part={name} style={{ ...style, ...s }}>
      {children}
    </div>
  );
}
