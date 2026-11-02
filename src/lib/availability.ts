export type TimeWindow = { start: number; end: number }

export function overlaps(first: TimeWindow, second: TimeWindow): boolean {
  return first.start < second.end && second.start < first.end
}

export function isSlotAvailable(
  slot: TimeWindow,
  workingHours: TimeWindow,
  occupied: TimeWindow[],
  breaks: TimeWindow[] = [],
): boolean {
  return (
    slot.start >= workingHours.start &&
    slot.end <= workingHours.end &&
    !occupied.some((window) => overlaps(slot, window)) &&
    !breaks.some((window) => overlaps(slot, window))
  )
}
