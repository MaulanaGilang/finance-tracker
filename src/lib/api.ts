import { createClient } from '@supabase/supabase-js'

export type TxType = 'income' | 'expense'

export interface Category {
  id: string
  name: string
  type: TxType
  color: string
  created_at: string
}

export interface Transaction {
  id: string
  type: TxType
  amount: number
  category_id: string | null
  date: string // YYYY-MM-DD
  note: string | null
  created_at: string
}

export interface TransactionInput {
  id?: string
  type: TxType
  amount: number
  category_id: string | null
  date: string
  note: string
}

export interface CategoryInput {
  id?: string
  name: string
  type: TxType
  color: string
}

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export class ApiError extends Error {}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new ApiError(error.message)
  return data as T
}

// Postgres numeric can arrive as a string; normalise once here.
const toTx = (t: Transaction): Transaction => ({ ...t, amount: Number(t.amount) })

export const api = {
  pinIsSet: () => rpc<boolean>('pin_is_set'),
  setupPin: (pin: string) => rpc<string>('setup_pin', { p_pin: pin }),
  login: (pin: string) => rpc<string | null>('login', { p_pin: pin }),
  logout: (token: string) => rpc<void>('logout', { p_token: token }),
  changePin: (token: string, oldPin: string, newPin: string) =>
    rpc<void>('change_pin', { p_token: token, p_old: oldPin, p_new: newPin }),

  getCategories: (token: string) => rpc<Category[]>('get_categories', { p_token: token }),
  saveCategory: (token: string, c: CategoryInput) =>
    rpc<Category>('save_category', {
      p_token: token,
      p_id: c.id ?? null,
      p_name: c.name,
      p_type: c.type,
      p_color: c.color,
    }),
  deleteCategory: (token: string, id: string) => rpc<void>('delete_category', { p_token: token, p_id: id }),

  getTransactions: async (token: string) =>
    (await rpc<Transaction[]>('get_transactions', { p_token: token })).map(toTx),
  saveTransaction: async (token: string, t: TransactionInput) =>
    toTx(
      await rpc<Transaction>('save_transaction', {
        p_token: token,
        p_id: t.id ?? null,
        p_type: t.type,
        p_amount: t.amount,
        p_category_id: t.category_id,
        p_date: t.date,
        p_note: t.note,
      }),
    ),
  deleteTransaction: (token: string, id: string) => rpc<void>('delete_transaction', { p_token: token, p_id: id }),
}

export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes('too_many_attempts')) return 'Too many wrong attempts. Try again in 15 minutes.'
  if (msg.includes('wrong_pin')) return 'Current PIN is incorrect.'
  if (msg.includes('pin_must_be_6_digits')) return 'PIN must be exactly 6 digits.'
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return 'No connection. Check your internet and try again.'
  return 'Something went wrong. Please try again.'
}
