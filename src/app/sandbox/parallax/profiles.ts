// SANDBOX — parallax profiles. DEV ONLY.
//
// A PLAIN MODULE, and the profiles carry FUNCTIONS, which is why this file
// exists separately from the stage. Two boundary rules bite here at once:
//
//   1. Anything a server component imports from a "use client" module arrives
//      as a client reference rather than a value. That is the same trap the
//      handoff timing constants fell into.
//   2. A function cannot be serialised across the server/client boundary at
//      all, so `<Stage profile={p} />` with `p.pose` on it is a 500 no matter
//      where the table lives.
//
// So the table is plain (both environments evaluate it for real) and the stage
// takes an ID and looks the profile up on the client, which never sends the
// function anywhere.

export type Pose = {
  yaw: number;
  pitch: number;
  scale: number;
  dx: number;
  dy: number;
  typeDx: number;
  lightX: number;
};

export type Profile = {
  id: string;
  label: string;
  note: string;
  pose: (u: number) => Pose;
};

/** Quintic ease-out: quick to settle, then almost still. */
const out = (u: number) => 1 - Math.pow(1 - u, 5);
const base: Pose = { yaw: 0, pitch: 0, scale: 1, dx: 0, dy: 0, typeDx: 0, lightX: -1.2 };
const P = (o: Partial<Pose>): Pose => ({ ...base, ...o });

export const PROFILES: Profile[] = [
  {
    id: "drift",
    label: "Drift",
    note: "Five degrees of yaw easing to nearly nothing. The plainest version",
    pose: (u) => P({ yaw: -5 + 6.5 * out(u) }),
  },
  {
    id: "settle",
    label: "Settle",
    note: "Yaw and pitch both easing out, as if a camera came to rest on it",
    pose: (u) => P({ yaw: -7 + 6 * out(u), pitch: 2.4 - 2.4 * out(u) }),
  },
  {
    id: "float",
    label: "Float",
    note: "A slow continuous arc, never resting. The only one still moving at the end",
    pose: (u) => P({
      yaw: 2.5 * Math.sin(u * Math.PI * 0.9),
      pitch: 1.1 * Math.cos(u * Math.PI * 0.9),
    }),
  },
  {
    id: "push",
    label: "Push in",
    note: "A four percent dolly with a touch of yaw. Grows into the frame",
    pose: (u) => P({ yaw: -3.5 + 3.5 * out(u), scale: 1 + 0.045 * out(u) }),
  },
  {
    id: "pull",
    label: "Pull back",
    note: "Starts slightly large and settles. Reads as arriving rather than approaching",
    pose: (u) => P({ yaw: 3.5 - 3.5 * out(u), scale: 1.05 - 0.05 * out(u) }),
  },
  {
    id: "rise",
    label: "Rise",
    note: "Lifts a little over one percent of frame height while the yaw resolves",
    pose: (u) => P({ yaw: -4 + 4 * out(u), dy: -0.014 * (1 - out(u)) }),
  },
  {
    id: "parallax",
    label: "True parallax",
    note: "Card one way, type the other. The only one where the two planes actually separate",
    pose: (u) => P({ yaw: -5 + 6 * out(u), typeDx: 0.011 * (1 - out(u)) }),
  },
  {
    id: "light",
    label: "Light only",
    note: "Geometry almost still; the key light travels instead, so the seal and the border catch",
    pose: (u) => P({ yaw: -1.5 + 3 * out(u), lightX: -2.4 + 4.2 * u }),
  },
];

export const byId = (id: string) => PROFILES.find((p) => p.id === id) ?? PROFILES[0];
