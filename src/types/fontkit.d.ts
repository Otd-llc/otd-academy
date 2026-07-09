// Minimal ambient types for fontkit (a devDependency used only by PDF glyph
// coverage tooling/tests — fontkit@2 ships no .d.ts). Only the surface we use.
declare module "fontkit" {
  export interface Font {
    hasGlyphForCodePoint(codePoint: number): boolean;
  }
  export function openSync(path: string, postscriptName?: string): Font;
  const fontkit: { openSync: typeof openSync };
  export default fontkit;
}
