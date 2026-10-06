import { useMemo, useState } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { GroupedTransactions } from '../components/TransactionList'
import { Button, Card, Empty, MonthStepper, PageHeader, Segmented, Skeleton, cx, inputClass, selectClass } from '../components/ui'
import type { TxType } from '../lib/api'
import { currentMonth, formatIDR, monthLabel } from '../lib/format'
import { inMonth, totals } from '../lib/stats'
import { useStore } from '../lib/store'

type TypeFilter = 'all' | TxType

export function Transactions() {
  const { transactions, categories, loading, openComposer } = useStore()
  const [month, setMonth] = useState(currentMonth)
  const [type, setType] = useState<TypeFilter>('all')
  const [categoryId, setCategoryId] = useState('all')
  const [query, setQuery] = useState('')

  const catOptions = useMemo(
    () => categories.filter((c) => type === 'all' || c.type === type),
    [categories, type],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const catName = new Map(categories.map((c) => [c.id, c.name.toLowerCase()]))
    return inMonth(transactions, month).filter(
      (t) =>
        (type === 'all' || t.type === type) &&
        (categoryId === 'all' || t.category_id === categoryId) &&
        (!q || (t.note ?? '').toLowerCase().includes(q) || (catName.get(t.category_id ?? '') ?? '').includes(q)),
    )
  }, [transactions, categories, month, type, categoryId, query])

  const sum = totals(filtered)
  const hasFilters = type !== 'all' || categoryId !== 'all' || query !== ''

  return (
    <div>
      <PageHeader title="Transactions">
        <MonthStepper value={month} onChange={setMonth} />
      </PageHeader>

      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
        <Segmented
          label="Filter by type"
          value={type}
          onChange={(v) => {
            setType(v)
            setCategoryId('all')
          }}
          options={[
            { value: 'all', label: 'All' },
            { value: 'income', label: 'Income' },
            { value: 'expense', label: 'Expense' },
          ]}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:flex md:flex-1 md:justify-end">
          <label className="sr-only" htmlFor="cat-filter">
            Category
          </label>
          <select
            id="cat-filter"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={cx(selectClass, 'h-11 md:w-52')}
          >
            <option value="all">All categories</option>
            {catOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="relative md:w-64">
            <label className="sr-only" htmlFor="search">
              Search notes
            </label>
            <MagnifyingGlass size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className={cx(inputClass, 'h-11 pl-10')}
            />
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 px-1 text-[14px] text-muted">
        <span>
          In <span className="tabular-nums text-income">{formatIDR(sum.income)}</span>
        </span>
        <span>
          Out <span className="tabular-nums text-ink">{formatIDR(sum.expense)}</span>
        </span>
        <span>{filtered.length} {filtered.length === 1 ? 'transaction' : 'transactions'}</span>
      </div>

      <Card className="px-2 py-4 sm:px-4 sm:py-5">
        {loading && transactions.length === 0 ? (
          <div className="flex flex-col gap-3 p-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          hasFilters ? (
            <Empty
              title="No matches"
              body="Nothing matches these filters this month."
              action={
                <Button
                  onClick={() => {
                    setType('all')
                    setCategoryId('all')
                    setQuery('')
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <Empty
              title={`No transactions in ${monthLabel(month)}`}
              body="Anything you add for this month will be listed here."
              action={
                <Button variant="primary" onClick={() => openComposer()}>
                  Add transaction
                </Button>
              }
            />
          )
        ) : (
          <GroupedTransactions items={filtered} />
        )}
      </Card>
    </div>
  )
}
