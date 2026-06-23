import {
  DIAGRAM_COMPONENTS,
  type DiagramComponent,
} from "@/components/guide/diagram-registry";

// Registry keys are virtual content paths like "/guide-diagrams/adc1-pin-map.svg".
// The render route and the exporter address diagrams by bare basename
// ("adc1-pin-map").
export function basenameOf(key: string): string {
  return key.replace(/^\/guide-diagrams\//, "").replace(/\.svg$/, "");
}

export function resolveDiagramKey(
  basename: string,
): { key: string; Comp: DiagramComponent } | null {
  for (const [key, Comp] of Object.entries(DIAGRAM_COMPONENTS)) {
    if (basenameOf(key) === basename) return { key, Comp };
  }
  return null;
}

export function allDiagramBasenames(): string[] {
  return Object.keys(DIAGRAM_COMPONENTS).map(basenameOf);
}
