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
 * Where to draw the icon for a field: its bottom right corner (the right end
 * of the centre line for a low field), or the nearest place to the left, then
 * along the top edge, that the page has left empty.
 */
export function iconPosition(field: Element, rect: DOMRect, own: Element): Point {
  const visible = (point: Point): Point => ({
    x: clamp(point.x, MARGIN, innerWidth - ICON - MARGIN),
    y: clamp(point.y, MARGIN, innerHeight - ICON - MARGIN),
  });
  // A field of one or two lines has no corner to sit in: the icon goes on its
  // centre line, where the page puts its own buttons.
  const tall = rect.height >= 2 * ICON + 4 * EDGE_Y;
  const preferred = visible({
    x: rect.right - ICON - EDGE_X,
    y: tall ? rect.bottom - ICON - EDGE_Y : rect.top + (rect.height - ICON) / 2,
  });

  const rows = [preferred.y];
  // A second row only where it is a different place.
  if (tall) rows.push(visible({ x: 0, y: rect.top + EDGE_Y }).y);

  for (const y of rows) {
    for (let step = 0; step < MAX_STEPS; step++) {
      const x = preferred.x - step * STEP;
      if (x < Math.max(rect.left + EDGE_X, MARGIN)) break;
      if (isFree({ x, y }, field, own)) return { x, y };
    }
  }
  return preferred;
}
