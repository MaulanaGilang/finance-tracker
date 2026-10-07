import type { Category, Transaction } from './api'
import type { Job, JobCategory, JobFlexibility, JobInput, JobStatus } from './jobs'
import { STATUS } from './jobs'
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

/** Fictional applications covering every status, so the Jobs screens can be checked without real data. */
export function demoJobs(): Job[] {
  const day = 864e5
  const rows: [string, string, string, JobCategory, JobFlexibility, JobStatus, string, number | null, number | null, number, number][] = [
    // position, company, location, category, flex, status, platform, salMin, salMax, appliedDaysAgo, statusDaysAgo
    ['Data Engineer', 'Kirana Logistik', 'Jakarta Selatan', 'full_time', 'hybrid', 'user_interview', 'LinkedIn', 9e6, 12e6, 30, 2],
    ['Analytics Engineer', 'Sagara Pay', 'Jakarta Pusat', 'full_time', 'remote', 'offer', 'Glints', 11e6, 14e6, 41, 1],
    ['Junior Data Engineer', 'Lumbung Tani', 'Bandung', 'contract', 'onsite', 'test', 'Glints', 6e6, 8e6, 16, 4],
    ['Data Engineer', 'Arunika Health', 'Jakarta Barat', 'full_time', 'onsite', 'hr_interview', 'Kalibrr', null, null, 12, 3],
    ['BI Engineer', 'Pelita Retail', 'Tangerang', 'contract', 'onsite', 'applied', 'LinkedIn', 7e6, 9e6, 12, 12],
    ['Data Engineer', 'Nusa Mobility', 'Jakarta Selatan', 'full_time', 'hybrid', 'applied', 'Dealls', null, null, 11, 11],
    ['ETL Developer', 'Banyu Energi', 'Bekasi', 'contract', 'onsite', 'applied', 'Glints', 5.5e6, 7e6, 4, 4],
    ['Data Platform Engineer', 'Rimba Cloud', 'Jakarta Pusat', 'full_time', 'remote', 'applied', 'LinkedIn', 12e6, 16e6, 2, 2],
    ['Data Engineer', 'Selaras Insurance', 'Jakarta Pusat', 'full_time', 'onsite', 'rejected', 'LinkedIn', 8e6, 10e6, 25, 9],
    ['Big Data Engineer', 'Cakra Telco', 'Jakarta Timur', 'full_time', 'onsite', 'ghosted', 'Indeed', null, null, 33, 5],
    ['Data Engineer Intern', 'Teras Edu', 'Depok', 'part_time', 'remote', 'medical_checkup', 'Instagram', 4e6, 5e6, 27, 1],
    ['Data Engineer', 'Kenari Media', 'Jakarta Selatan', 'contract', 'onsite', 'other', 'Kalibrr', null, null, 9, 6],
  ]
  const iso = (ago: number) => new Date(Date.now() - ago * day).toISOString()
  return rows.map(([position, company, location, category, flexibility, status, platform, salary_min, salary_max, applied, changed], i) => ({
    id: `demo-job-${i}`,
    position,
    company,
    location,
    category,
    flexibility,
    status,
    platform,
    link: 'https://example.com',
    salary_min,
    salary_max,
    applied_date: iso(applied).slice(0, 10),
    status_changed_at: iso(changed),
    auto_ghosted: status === 'ghosted',
    max_stage: status === 'rejected' ? 1 : (STATUS[status].stage ?? 0),
    notes: null,
    created_at: iso(applied),
    updated_at: iso(changed),
  }))
}

/** Demo mode only: apply a job save in memory, mirroring save_job's rules (clock reset, max stage). */
export function demoSaveJob(jobs: Job[], input: JobInput): Job {
  const now = new Date().toISOString()
  const prev = jobs.find((j) => j.id === input.id)
  const changed = !prev || prev.status !== input.status
  const stage = STATUS[input.status].stage ?? 0
  return {
    ...(prev ?? { id: `demo-job-${Date.now()}`, created_at: now, auto_ghosted: false, max_stage: 0 }),
    ...input,
    id: prev?.id ?? `demo-job-${Date.now()}`,
    location: input.location || null,
    platform: input.platform || null,
    link: input.link || null,
    notes: input.notes || null,
    status_changed_at: changed ? (prev ? now : new Date(input.applied_date + 'T00:00:00').toISOString()) : prev!.status_changed_at,
    auto_ghosted: changed ? false : prev!.auto_ghosted,
    max_stage: Math.max(prev?.max_stage ?? 0, stage),
    updated_at: now,
  } as Job
}
