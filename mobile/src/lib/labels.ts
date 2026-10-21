/**
 * Which venue names fit on the map without overlapping, like Apple / Google Maps:
 * names that would cover another one are hidden until the user zooms in further.
 */
export type ScreenPoint = { x: number; y: number };

type Labelled = { id: number; name: string; lat: number; lon: number };

// Like Apple / Google Maps: the name sits to the right of the icon, in its colour, on up to two lines
export const LABEL_MAX_WIDTH = 110;
export const LABEL_LINE_HEIGHT = 15;
// Rough width of one character at 12 px
const CHAR_WIDTH = 6.5;
// Gap kept between two names
const PADDING = 4;
// Half of a venue dot; the name starts just after it
const DOT_HALF = 11;
const GAP = 3;

/** Width and height of a name: one line, or two when it is longer than the maximum width. */
export function labelSize(name: string): { width: number; height: number } {
  const width = name.length * CHAR_WIDTH + 4;
  return width <= LABEL_MAX_WIDTH
    ? { width, height: LABEL_LINE_HEIGHT }
    : { width: LABEL_MAX_WIDTH, height: 2 * LABEL_LINE_HEIGHT };
}

/**
 * Ids of the venues whose name can be shown. Earlier venues in `venues` win
 * (put the selected one first). `project` turns a position into screen pixels.
 */
export function visibleLabels<T extends Labelled>(venues: T[], project: (venue: T) => ScreenPoint): Set<number> {
  const points = new Map(venues.map((v) => [v.id, project(v)]));
  const dots = venues.map((v) => {
    const { x, y } = points.get(v.id)!;
    return { id: v.id, left: x - DOT_HALF, right: x + DOT_HALF, top: y - DOT_HALF, bottom: y + DOT_HALF };
  });
  const placed: { left: number; right: number; top: number; bottom: number }[] = [];
  const shown = new Set<number>();
  for (const venue of venues) {
    const { x, y } = points.get(venue.id)!;
    const { width, height } = labelSize(venue.name);
    const left = x + DOT_HALF + GAP;
    const box = { left, right: left + width, top: y - height / 2, bottom: y + height / 2 };
    const coversDot = dots.some(
      (d) => d.id !== venue.id && box.left < d.right && box.right > d.left && box.top < d.bottom && box.bottom > d.top,
    );
    const overlaps =
      coversDot ||
      placed.some(
        (p) =>
          box.left < p.right + PADDING &&
          box.right > p.left - PADDING &&
          box.top < p.bottom + PADDING &&
          box.bottom > p.top - PADDING,
      );
    if (overlaps) continue;
    placed.push(box);
    shown.add(venue.id);
  }
  return shown;
}

/** Selected venue first, then venues with fresh check-ins, then the rest (stable). */
export function labelPriority<T extends { id: number; crowd?: { state: string } }>(venues: T[], selectedId: number | null): T[] {
  const rank = (v: T) => (v.id === selectedId ? 0 : v.crowd?.state === 'live' ? 1 : 2);
  return [...venues].sort((a, b) => rank(a) - rank(b));
}
