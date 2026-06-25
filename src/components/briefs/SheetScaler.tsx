"use client";

// Scales a fixed-width "sheet" down to fit narrower containers, so the brief
// renders pixel-for-pixel at its native width on desktop and shrinks intact on
// mobile (no reflow, so it always matches the PDF). Sets the outer height to the
// scaled height so surrounding layout flows correctly.
import { useEffect, useRef, useState, type ReactNode } from "react";

export function SheetScaler({
  width,
  children,
}: {
  width: number;
  children: ReactNode;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const update = () => {
      const s = Math.min(1, o.clientWidth / width);
      setScale(s);
      setHeight(i.offsetHeight * s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div
      ref={outer}
      className="sheet-scaler-outer"
      style={{ height, overflow: "hidden" }}
    >
      <div
        ref={inner}
        className="sheet-scaler-inner"
        style={{
          width,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
