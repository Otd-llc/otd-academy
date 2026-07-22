// KaTeX stylesheet scoped to the lesson route — the only place (with the guide
// routes) that renders `math` blocks (GuideBlocks server-side
// katex.renderToString). See the guide layout twin; removed from the root
// layout to keep ~23 KB of CSS off math-free routes.
import "katex/dist/katex.min.css";

export default function LessonLayout({ children }: { children: React.ReactNode }) {
  return children;
}
