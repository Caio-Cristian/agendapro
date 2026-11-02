import { describe, expect, it } from 'vitest'
import { isSlotAvailable, overlaps } from './availability'

describe('overlaps', () => {
  it('detects partial and fully contained overlap', () => {
    expect(overlaps({ start: 10, end: 40 }, { start: 35, end: 60 })).toBe(true)
    expect(overlaps({ start: 15, end: 25 }, { start: 10, end: 40 })).toBe(true)
  })

  it('treats adjacent appointments as non-overlapping', () => {
    expect(overlaps({ start: 10, end: 30 }, { start: 30, end: 45 })).toBe(false)
  })
})

describe('isSlotAvailable', () => {
  const workingHours = { start: 9 * 60, end: 18 * 60 }

  it('accepts a slot within working hours with no conflicts', () => {
    expect(isSlotAvailable({ start: 10 * 60, end: 10 * 60 + 45 }, workingHours, [])).toBe(true)
  })

  it('rejects slots outside working hours, bookings and breaks', () => {
    expect(isSlotAvailable({ start: 8 * 60, end: 9 * 60 }, workingHours, [])).toBe(false)
    expect(
      isSlotAvailable({ start: 10 * 60, end: 10 * 60 + 45 }, workingHours, [
        { start: 10 * 60 + 30, end: 11 * 60 },
      ]),
    ).toBe(false)
    expect(
      isSlotAvailable(
        { start: 12 * 60, end: 13 * 60 },
        workingHours,
        [],
        [{ start: 12 * 60 + 15, end: 13 * 60 }],
      ),
    ).toBe(false)
  })
})
