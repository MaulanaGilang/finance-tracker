import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X } from '@phosphor-icons/react'
import { EASE_OUT, sheetSpring } from '../lib/motion'
import type { TxType } from '../lib/api'
import { friendlyError } from '../lib/api'
import { formatNumber, parseAmount, todayISO } from '../lib/format'
import { useStore } from '../lib/store'
import { Button, Field, IconButton, Segmented, cx, inputClass } from './ui'

const LAST_CAT_KEY = (t: TxType) => `ledger.lastCategory.${t}`
const readLast = (t: TxType) => {
  try {
    return localStorage.getItem(LAST_CAT_KEY(t))
  } catch {
    return null
  }
}
const writeLast = (t: TxType, id: string | null) => {
  try {
    if (id) localStorage.setItem(LAST_CAT_KEY(t), id)
  } catch {
    /* ignore */
  }
}

/** Mounted only while open, so every open starts from fresh state. */
export function Composer() {
  const { composer, closeComposer } = useStore()
  return (
    <AnimatePresence>
      {composer.open && <ComposerSheet key={composer.editing?.id ?? 'new'} onClose={closeComposer} />}
    </AnimatePresence>
  )
}

const isWide = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches

function ComposerSheet({ onClose }: { onClose: () => void }) {
  const { composer, categories, saveTransaction, deleteTransaction } = useStore()
  const editing = composer.editing

  const [type, setType] = useState<TxType>(editing?.type ?? 'expense')
  const [amount, setAmount] = useState(editing ? formatNumber(editing.amount) : '')
  const [date, setDate] = useState(editing?.date ?? todayISO())
  const [note, setNote] = useState(editing?.note ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(editing?.category_id ?? null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const amountRef = useRef<HTMLInputElement>(null)
  const [wide] = useState(isWide)

  const options = useMemo(() => categories.filter((c) => c.type === type), [categories, type])

  // Keep the selected category valid for the chosen type; default to the last one used.
  useEffect(() => {
    if (categoryId && options.some((c) => c.id === categoryId)) return
    const last = readLast(type)
    setCategoryId(options.find((c) => c.id === last)?.id ?? options[0]?.id ?? null)
  }, [type, options, categoryId])

  useEffect(() => {
    if (!editing) amountRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [editing, onClose])

  const value = parseAmount(amount)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (value <= 0) {
      setError('Enter an amount greater than zero.')
      amountRef.current?.focus()
      return
    }
    setBusy(true)
    setError(null)
    try {
      await saveTransaction({ id: editing?.id, type, amount: value, category_id: categoryId, date, note })
      writeLast(type, categoryId)
      onClose()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!editing || !confirm('Delete this transaction?')) return
    setBusy(true)
    try {
      await deleteTransaction(editing.id)
      onClose()
    } catch (err) {
      setError(friendlyError(err))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="composer-title">
      <motion.div
        className="absolute inset-0 bg-ink/20 backdrop-blur-[6px]"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.3 } }}
        exit={{ opacity: 0, transition: { duration: 0.2 } }}
      />
      {/* Phones: springs up from the bottom edge. Larger screens: focuses in at the centre. */}
      <motion.form
        onSubmit={save}
        initial={wide ? { opacity: 0, scale: 0.97, y: 12, filter: 'blur(6px)' } : { y: '100%' }}
        animate={
          wide
            ? { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: EASE_OUT }, transitionEnd: { filter: 'none' } }
            : { y: 0, transition: sheetSpring }
        }
        exit={wide ? { opacity: 0, scale: 0.98, filter: 'blur(4px)', transition: { duration: 0.2 } } : { y: '100%', transition: { duration: 0.25, ease: 'easeIn' } }}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-y-auto rounded-t-[24px] bg-canvas/85 px-5 backdrop-blur-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 sm:max-w-[480px] sm:rounded-card sm:border sm:border-line sm:p-8"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 id="composer-title" className="font-display text-[21px]">
            {editing ? 'Edit transaction' : 'New transaction'}
          </h2>
          <IconButton label="Close" type="button" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>

        <Segmented
          label="Type"
          value={type}
          onChange={setType}
          className="mb-6 w-full"
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
          ]}
        />

        <div className="mb-6">
          <label htmlFor="amount" className="mb-2 block text-[13px] font-[480] text-muted">
            Amount
          </label>
          <div className="flex items-baseline gap-2 border-b border-line-strong pb-2 focus-within:border-forest">
            <span className="font-display text-[24px] text-muted">Rp</span>
            <input
              ref={amountRef}
              id="amount"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              value={amount}
              onChange={(e) => {
                const n = parseAmount(e.target.value)
                setAmount(n ? formatNumber(n) : '')
              }}
              className={cx(
                'w-full min-w-0 bg-transparent font-display text-[36px] leading-[1.15] tabular-nums placeholder:text-line-strong focus:outline-none',
                type === 'income' && 'text-income',
              )}
            />
          </div>
        </div>

        <fieldset className="mb-6">
          <legend className="mb-3 text-[13px] font-[480] text-muted">Category</legend>
          {options.length === 0 ? (
            <p className="text-[14px] text-muted">No {type} categories yet. Add one in Settings.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {options.map((c) => {
                const active = c.id === categoryId
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => setCategoryId(c.id)}
                    aria-pressed={active}
                    className={cx(
                      'inline-flex h-9 items-center gap-2 rounded-pill border px-3.5 text-[14px] transition-colors',
                      active ? 'border-forest bg-forest-soft font-[480] text-forest' : 'border-line bg-card text-ink hover:border-line-strong',
                    )}
                  >
                    <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </button>
                )
              })}
            </div>
          )}
        </fieldset>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr]">
          <Field label="Date" htmlFor="date">
            <input id="date" type="date" required value={date} max="9999-12-31" onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Note (optional)" htmlFor="note">
            <input
              id="note"
              value={note}
              maxLength={120}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Lunch with team"
              className={inputClass}
            />
          </Field>
        </div>

        <p className={cx('mb-3 min-h-5 text-[14px] text-expense', !error && 'invisible')} role="alert">
          {error ?? ' '}
        </p>

        <div className="flex gap-3">
          {editing && (
            <Button type="button" variant="danger" onClick={remove} disabled={busy}>
              Delete
            </Button>
          )}
          <Button type="submit" variant="primary" className="flex-1" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add transaction'}
          </Button>
        </div>
      </motion.form>
    </div>
  )
}
