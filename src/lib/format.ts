export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(
    'pt-BR',
    options ?? { day: '2-digit', month: 'long', year: 'numeric' },
  ).format(new Date(date))
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(date),
  )
}

export function getRange(
  period: 'day' | 'week' | 'month',
  anchor = new Date(),
): { start: Date; end: Date } {
  const start = new Date(anchor)
  const end = new Date(anchor)
  start.setHours(0, 0, 0, 0)
  if (period === 'day') {
    end.setHours(23, 59, 59, 999)
  } else if (period === 'week') {
    const weekday = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - weekday)
    end.setTime(start.getTime())
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
  } else {
    start.setDate(1)
    end.setMonth(end.getMonth() + 1, 0)
    end.setHours(23, 59, 59, 999)
  }
  return { start, end }
}
