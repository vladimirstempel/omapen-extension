export const ICON = 26;

const EDGE_X = 8;
const EDGE_Y = 6;
const STEP = ICON + 6;
const MAX_STEPS = 6;
const MARGIN = 8;

export interface Point {
  x: number;
  y: number;
}

/**
 * True when nothing of the page lies over the field in the icon square at
 * `point`. Send buttons, emoji buttons and counters are usually siblings of
 * the field that are drawn over it, so they show up here.
 */
function isFree(point: Point, field: Element, own: Element): boolean {
  const inset = 3;
  const probes = [
    [point.x + ICON / 2, point.y + ICON / 2],
    [point.x + inset, point.y + inset],
    [point.x + ICON - inset, point.y + inset],
    [point.x + inset, point.y + ICON - inset],
    [point.x + ICON - inset, point.y + ICON - inset],
  ];
  return probes.every(([x, y]) => {
    const top = document.elementsFromPoint(x, y).find((element) => element !== own);
    // The field, text in it, or a wrapper around it: not in the way.
    return !top || top === field || field.contains(top) || top.contains(field);
  });
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/**
 * Where to draw the icon for a field: its bottom right corner, or the nearest
 * place along the bottom or the top edge that the page has left empty.
 */
export function iconPosition(field: Element, rect: DOMRect, own: Element): Point {
  const visible = (point: Point): Point => ({
    x: clamp(point.x, MARGIN, innerWidth - ICON - MARGIN),
    y: clamp(point.y, MARGIN, innerHeight - ICON - MARGIN),
  });
  const preferred = visible({ x: rect.right - ICON - EDGE_X, y: rect.bottom - ICON - EDGE_Y });

  const rows = [preferred.y];
  // A second row only where it is a different place.
  if (rect.height >= 2 * ICON + 4 * EDGE_Y) rows.push(visible({ x: 0, y: rect.top + EDGE_Y }).y);

  for (const y of rows) {
    for (let step = 0; step < MAX_STEPS; step++) {
      const x = preferred.x - step * STEP;
      if (x < Math.max(rect.left + EDGE_X, MARGIN)) break;
      if (isFree({ x, y }, field, own)) return { x, y };
    }
  }
  return preferred;
}
