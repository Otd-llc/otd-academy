import type { RenderBounds } from "@/lib/schemas/part-asset";

/** Bounding sphere from a flat XYZ position array (mesh vertices). Returns a
 *  unit fallback for an empty array so the viewer still frames something. */
export function boundsFromPositions(positions: ArrayLike<number>): RenderBounds {
  if (positions.length < 3) return { center: [0, 0, 0], radius: 1 };
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (let i = 0; i + 2 < positions.length; i += 3) {
    const x = positions[i],
      y = positions[i + 1],
      z = positions[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const center: [number, number, number] = [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
  ];
  const dx = maxX - minX,
    dy = maxY - minY,
    dz = maxZ - minZ;
  const radius = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz) / 2, 1e-6);
  return { center, radius };
}
