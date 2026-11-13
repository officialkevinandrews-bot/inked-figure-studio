export interface BoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_SIZE = 20;

/**
 * Computes the resized bounding box while keeping the opposite edge/corner anchored
 * (e.g., dragging "w" or "n" shifts x/y rather than drifting the bottom-right corner).
 */
export function computeResizedBox(
  start: BoxRect,
  handle: string,
  dx: number,
  dy: number,
  preserveAspect = false,
): BoxRect {
  let newX = start.x;
  let newY = start.y;
  let newW = start.width;
  let newH = start.height;

  const hasW = handle.includes("w");
  const hasE = handle.includes("e");
  const hasN = handle.includes("n");
  const hasS = handle.includes("s");

  if (hasE) newW = Math.max(MIN_SIZE, start.width + dx);
  if (hasS) newH = Math.max(MIN_SIZE, start.height + dy);
  if (hasW) {
    newW = Math.max(MIN_SIZE, start.width - dx);
    newX = start.x + (start.width - newW);
  }
  if (hasN) {
    newH = Math.max(MIN_SIZE, start.height - dy);
    newY = start.y + (start.height - newH);
  }

  if (preserveAspect && start.height > 0 && start.width > 0) {
    const aspect = start.width / start.height;
    if (hasE || hasW || (!hasN && !hasS)) {
      const candidateH = Math.max(MIN_SIZE, newW / aspect);
      if (hasN) newY = start.y + (start.height - candidateH);
      newH = candidateH;
    } else {
      const candidateW = Math.max(MIN_SIZE, newH * aspect);
      if (hasW) newX = start.x + (start.width - candidateW);
      newW = candidateW;
    }
  }

  return { x: newX, y: newY, width: newW, height: newH };
}

