import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { demoCategories, demoTransactions, isDemo } from './demo'
import { api, ApiError, type Category, type CategoryInput, type Transaction, type TransactionInput } from './api'

type Status = 'checking' | 'setup' | 'locked' | 'ready' | 'offline'

interface Store {
  status: Status
  loading: boolean
  loadError: string | null
  categories: Category[]
  transactions: Transaction[]

  setupPin: (pin: string) => Promise<void>
  unlock: (pin: string) => Promise<boolean>
  lock: () => Promise<void>
  changePin: (oldPin: string, newPin: string) => Promise<void>
  reload: () => Promise<void>

  saveTransaction: (t: TransactionInput) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  saveCategory: (c: CategoryInput) => Promise<void>
  deleteCategory: (id: string) => Promise<void>

  composer: { open: boolean; editing: Transaction | null }
  /** id of the transaction just saved, briefly highlighted in lists */
  highlightId: string | null
  openComposer: (editing?: Transaction) => void
  closeComposer: () => void
}

const TOKEN_KEY = 'ledger.session'
const Ctx = createContext<Store | null>(null)

const readToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
const writeToken = (t: string | null) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable: session lasts for this tab only */
  }
}

const isSessionError = (e: unknown) => e instanceof ApiError && e.message.includes('invalid_session')

export function StoreProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(readToken)
  const [status, setStatus] = useState<Status>('checking')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [composer, setComposer] = useState<{ open: boolean; editing: Transaction | null }>({
    open: false,
    editing: null,
  })
  const [highlightId, setHighlightId] = useState<string | null>(null)
  useEffect(() => {
    if (!highlightId) return
    const t = setTimeout(() => setHighlightId(null), 1800)
    return () => clearTimeout(t)
  }, [highlightId])

  const resetToLock = useCallback(async () => {
    writeToken(null)
    setToken(null)
    setCategories([])
    setTransactions([])
    try {
      setStatus((await api.pinIsSet()) ? 'locked' : 'setup')
    } catch {
      setStatus('offline')
    }
  }, [])

  const load = useCallback(
    async (t: string) => {
      setLoading(true)
      setLoadError(null)
      try {
        const [cats, txs] = await Promise.all([api.getCategories(t), api.getTransactions(t)])
        setCategories(cats)
        setTransactions(txs)
        setStatus('ready')
      } catch (e) {
        if (isSessionError(e)) await resetToLock()
        else {
          setLoadError('Could not load your data. Check your connection.')
          setStatus((s) => (s === 'checking' ? 'offline' : s))
        }
      } finally {
        setLoading(false)
      }
    },
    [resetToLock],
  )

  useEffect(() => {
    if (isDemo) {
      // View-only sample data for local design work; saving is not supported in demo mode.
      setCategories(demoCategories)
      setTransactions(demoTransactions())
      setStatus('ready')
      return
    }
    if (token) load(token)
    else resetToLock()
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Wrap a mutation so an expired session drops back to the PIN screen */
  const guarded = useCallback(
    async <T,>(fn: (t: string) => Promise<T>): Promise<T> => {
      if (!token) throw new ApiError('invalid_session')
      try {
        return await fn(token)
      } catch (e) {
        if (isSessionError(e)) await resetToLock()
        throw e
      }
    },
    [token, resetToLock],
  )

  const startSession = useCallback(
    async (t: string) => {
      writeToken(t)
      setToken(t)
      await load(t)
    },
    [load],
  )

  const value = useMemo<Store>(
    () => ({
      status,
      loading,
      loadError,
      categories,
      transactions,

      setupPin: async (pin) => startSession(await api.setupPin(pin)),
      unlock: async (pin) => {
        const t = await api.login(pin)
        if (!t) return false
        await startSession(t)
        return true
      },
      lock: async () => {
        if (token) api.logout(token).catch(() => {})
        await resetToLock()
      },
      changePin: (oldPin, newPin) => guarded((t) => api.changePin(t, oldPin, newPin)),
      reload: async () => {
        if (token) await load(token)
        else await resetToLock()
      },

      saveTransaction: async (input) => {
        const saved = await guarded((t) => api.saveTransaction(t, input))
        setTransactions((prev) =>
          [saved, ...prev.filter((x) => x.id !== saved.id)].sort(
            (a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at),
          ),
        )
        setHighlightId(saved.id)
      },
      deleteTransaction: async (id) => {
        await guarded((t) => api.deleteTransaction(t, id))
        setTransactions((prev) => prev.filter((x) => x.id !== id))
      },
      saveCategory: async (input) => {
        const saved = await guarded((t) => api.saveCategory(t, input))
        setCategories((prev) =>
          prev.some((c) => c.id === saved.id) ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved],
        )
      },
      deleteCategory: async (id) => {
        await guarded((t) => api.deleteCategory(t, id))
        setCategories((prev) => prev.filter((c) => c.id !== id))
        setTransactions((prev) => prev.map((x) => (x.category_id === id ? { ...x, category_id: null } : x)))
      },

      composer,
      highlightId,
      openComposer: (editing) => setComposer({ open: true, editing: editing ?? null }),
      closeComposer: () => setComposer((c) => ({ ...c, open: false })),
    }),
    [status, loading, loadError, categories, transactions, composer, highlightId, token, guarded, load, resetToLock, startSession],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}

export function useCategoryMap() {
  const { categories } = useStore()
  return useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
}
