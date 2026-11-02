import { describe, expect, it } from 'vitest'
import { serviceSchema, signInSchema, signUpSchema } from './auth'

describe('validation schemas', () => {
  it('rejects invalid sign-in credentials', () => {
    expect(signInSchema.safeParse({ email: 'invalid', password: '' }).success).toBe(false)
  })

  it('requires a valid email and strong enough password for signup', () => {
    expect(
      signUpSchema.safeParse({
        full_name: 'Ana Maria',
        email: 'ana@example.com',
        password: 'secure-123',
      }).success,
    ).toBe(true)
    expect(
      signUpSchema.safeParse({
        full_name: 'Ana Maria',
        email: 'ana@example.com',
        password: 'secure-123',
        business_name: 'Studio Aurora',
      }).success,
    ).toBe(true)
    expect(
      signUpSchema.safeParse({
        full_name: 'Ana Maria',
        email: 'ana@example.com',
        password: 'secure-123',
        business_name: 'A',
      }).success,
    ).toBe(false)
    expect(signUpSchema.safeParse({ full_name: 'A', email: 'bad', password: '123' }).success).toBe(
      false,
    )
  })

  it('enforces valid service prices and durations', () => {
    expect(
      serviceSchema.safeParse({ name: 'Corte', duration_minutes: '45', price: '75.5' }).success,
    ).toBe(true)
    expect(serviceSchema.safeParse({ name: 'X', duration_minutes: 10, price: -2 }).success).toBe(
      false,
    )
  })
})
