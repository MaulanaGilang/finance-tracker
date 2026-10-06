import type { Category, Transaction } from './api'
import { addMonths, currentMonth } from './format'

/** Dev-only: http://localhost:5173/?demo renders the app on in-memory sample data, no network. */
export const isDemo = import.meta.env.DEV && new URLSearchParams(location.search).has('demo')

const cat = (id: string, name: string, type: Category['type'], color: string): Category => ({
  id,
  name,
  type,
  color,
  created_at: '2026-01-01T00:00:00Z',
})

export const demoCategories: Category[] = [
  cat('salary', 'Salary', 'income', '#2F7A55'),
  cat('freelance', 'Freelance', 'income', '#4E9470'),
  cat('food', 'Food', 'expense', '#1F4D3A'),
  cat('transport', 'Transport', 'expense', '#3F6E5A'),
  cat('bills', 'Bills', 'expense', '#6B8F7D'),
  cat('shopping', 'Shopping', 'expense', '#A3B8AC'),
  cat('fun', 'Entertainment', 'expense', '#B5483B'),
  cat('health', 'Health', 'expense', '#C9846F'),
]

export function demoTransactions(): Transaction[] {
  const now = currentMonth()
  const rows: [number, Transaction['type'], number, string, string | null][] = [
    // [monthsAgo, type, amount, categoryId, note]
    [5, 'income', 9500000, 'salary', null], [5, 'expense', 4150000, 'food', null], [5, 'expense', 1800000, 'bills', 'Rent share'],
    [4, 'income', 9500000, 'salary', null], [4, 'expense', 4600000, 'food', null], [4, 'expense', 1250000, 'shopping', 'Shoes'], [4, 'expense', 1800000, 'bills', 'Rent share'],
    [3, 'income', 9500000, 'salary', null], [3, 'expense', 5300000, 'food', null], [3, 'expense', 1800000, 'bills', 'Rent share'],
    [2, 'income', 9500000, 'salary', null], [2, 'income', 1750000, 'freelance', 'Logo project'], [2, 'expense', 4450000, 'food', null], [2, 'expense', 900000, 'fun', 'Concert'], [2, 'expense', 1800000, 'bills', 'Rent share'],
    [1, 'income', 9500000, 'salary', null], [1, 'expense', 3900000, 'food', null], [1, 'expense', 6100000, 'bills', 'Rent + utilities'], [1, 'expense', 480000, 'health', 'Dentist'],
    [0, 'income', 2400000, 'freelance', 'Landing page'], [0, 'expense', 1800000, 'bills', 'Rent share'], [0, 'expense', 38000, 'transport', 'Gojek'],
    [0, 'expense', 245000, 'shopping', 'Groceries'], [0, 'expense', 120000, 'fun', 'Movie'], [0, 'expense', 85000, 'food', 'Lunch'],
  ]
  return rows
    .map(([ago, type, amount, category_id, note], i) => {
      const day = ago === 0 ? Math.min(5, 1 + (i % 5)) : 3 + ((i * 7) % 24)
      const date = `${addMonths(now, -ago)}-${String(day).padStart(2, '0')}`
      return { id: `demo-${i}`, type, amount, category_id, date, note, created_at: `${date}T12:00:00Z` }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}
