const SCROLL_EDGE_TOLERANCE = 2;

export function horizontalCalendarViewShift({
  scrollLeft,
  clientWidth,
  scrollWidth,
}: {
  scrollLeft: number;
  clientWidth: number;
  scrollWidth: number;
}): -1 | 0 | 1 {
  const maxScrollLeft = scrollWidth - clientWidth;
  if (clientWidth <= 0 || maxScrollLeft <= SCROLL_EDGE_TOLERANCE) {
    return 0;
  }
  if (scrollLeft <= SCROLL_EDGE_TOLERANCE) {
    return -1;
  }
  if (scrollLeft >= maxScrollLeft - SCROLL_EDGE_TOLERANCE) {
    return 1;
  }
  return 0;
}
