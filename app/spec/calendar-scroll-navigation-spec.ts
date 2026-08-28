import { horizontalCalendarViewShift } from '../internal_packages/main-calendar/lib/core/calendar-scroll-navigation';

describe('horizontalCalendarViewShift', () => {
  it('requests the previous view at the left buffer edge', () => {
    expect(
      horizontalCalendarViewShift({ scrollLeft: 0, clientWidth: 800, scrollWidth: 2400 })
    ).toBe(-1);
  });

  it('requests the next view at the right buffer edge', () => {
    expect(
      horizontalCalendarViewShift({ scrollLeft: 1600, clientWidth: 800, scrollWidth: 2400 })
    ).toBe(1);
  });

  it('does not navigate while the focused view is centered', () => {
    expect(
      horizontalCalendarViewShift({ scrollLeft: 800, clientWidth: 800, scrollWidth: 2400 })
    ).toBe(0);
  });

  it('does not navigate when there is no horizontal overflow', () => {
    expect(
      horizontalCalendarViewShift({ scrollLeft: 0, clientWidth: 800, scrollWidth: 800 })
    ).toBe(0);
  });
});
