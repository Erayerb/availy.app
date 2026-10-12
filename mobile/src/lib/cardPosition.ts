export type Point = { x: number; y: number };

type Layout = {
  pin: Point; // pin tip in screen coordinates
  card: { width: number; height: number };
  screen: { width: number; height: number };
  topInset: number; // space taken by the header/filters
  margin: number;
  pinHeight: number;
};

/** Place the card above the pin; flip below it when there is no room; keep it on screen. */
export function cardPosition({ pin, card, screen, topInset, margin, pinHeight }: Layout): Point {
  const maxLeft = screen.width - card.width - margin;
  const left = Math.min(Math.max(pin.x - card.width / 2, margin), maxLeft);

  const above = pin.y - pinHeight - card.height - 8;
  const top = above >= topInset ? above : pin.y + 8;
  return { x: left, y: Math.min(top, screen.height - card.height - margin) };
}
