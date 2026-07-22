// KaTeX stylesheet scoped to the guide routes — the only place (with
// /library/[slug]) that renders `math` blocks (GuideBlocks server-side
// katex.renderToString). It used to ride in the ROOT layout, shipping ~23 KB
// of render-blocking CSS to every math-free route (home, account, logbook…).
import "katex/dist/katex.min.css";

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return children;
}
