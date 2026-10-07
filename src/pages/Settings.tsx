import { useState } from 'react'
import { DownloadSimple, LockSimple, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { Button, Card, CardTitle, Field, IconButton, PageHeader, cx, inputClass } from '../components/ui'
import type { Category, TxType } from '../lib/api'
import { friendlyError } from '../lib/api'
import { todayISO } from '../lib/format'
import { CATEGORY, FLEXIBILITY, GHOST_DAYS, STATUS } from '../lib/jobs'
import { useStore } from '../lib/store'
import type { Tool } from '../components/AppShell'

const SWATCHES = ['#1F4D3A', '#2F7A55', '#3F6E5A', '#4E9470', '#6B8F7D', '#8DB59E', '#A3B8AC', '#B5483B', '#C9846F', '#D4A65A', '#5B6B8C', '#B9BDB7']

/**
 * Settings, scoped to the tool you're in. Security (PIN, lock) and the full backup are shared;
 * everything else only shows in its own tool.
 */
export function Settings({ tool }: { tool: Tool }) {
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <PageHeader title="Settings" />
      {tool === 'budget' && (
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <CategoryManager type="expense" />
          <CategoryManager type="income" />
        </div>
      )}
      {tool === 'jobs' && (
        <Card>
          <CardTitle>Ghost rule</CardTitle>
          <p className="max-w-[60ch] text-[14px] leading-[1.6] text-muted">
            An application still waiting on the company is marked <span className="text-ink">Ghosted</span> after {GHOST_DAYS} days
            without a status change. It shows an "auto" tag so you know the app did it. If the company gets back to you later,
            just change the status: the {GHOST_DAYS}-day clock restarts. Offers and accepted jobs are never ghosted.
          </p>
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <Backup tool={tool} />
        <Security />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function CategoryManager({ type }: { type: TxType }) {
  const { categories, transactions, saveCategory, deleteCategory } = useStore()
  const list = categories.filter((c) => c.type === type)
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function remove(c: Category) {
    const used = transactions.filter((t) => t.category_id === c.id).length
    const msg = used
      ? `Delete "${c.name}"? ${used} transaction${used === 1 ? '' : 's'} will become uncategorised.`
      : `Delete "${c.name}"?`
    if (!confirm(msg)) return
    try {
      await deleteCategory(c.id)
    } catch (e) {
      setError(friendlyError(e))
    }
  }

  return (
    <Card>
      <CardTitle
        action={
          editing !== 'new' && (
            <Button className="h-9 px-4 text-[14px]" onClick={() => setEditing('new')}>
              <Plus size={14} weight="bold" /> Add
            </Button>
          )
        }
      >
        {type === 'expense' ? 'Expense categories' : 'Income categories'}
      </CardTitle>

      {editing === 'new' && (
        <CategoryForm
          type={type}
          onCancel={() => setEditing(null)}
          onSave={async (name, color) => {
            await saveCategory({ name, type, color })
            setEditing(null)
          }}
        />
      )}

      <ul className="flex flex-col">
        {list.map((c) =>
          editing !== 'new' && editing?.id === c.id ? (
            <li key={c.id}>
              <CategoryForm
                type={type}
                initial={c}
                onCancel={() => setEditing(null)}
                onSave={async (name, color) => {
                  await saveCategory({ id: c.id, name, type, color })
                  setEditing(null)
                }}
              />
            </li>
          ) : (
            <li key={c.id} className="flex items-center gap-3 py-1.5">
              <span className="size-3 shrink-0 rounded-full" style={{ background: c.color }} />
              <span className="flex-1 truncate text-[15px]">{c.name}</span>
              <IconButton label={`Edit ${c.name}`} onClick={() => setEditing(c)}>
                <PencilSimple size={17} />
              </IconButton>
              <IconButton label={`Delete ${c.name}`} onClick={() => remove(c)} className="hover:text-expense">
                <Trash size={17} />
              </IconButton>
            </li>
          ),
        )}
      </ul>
      {list.length === 0 && editing !== 'new' && <p className="text-[14px] text-muted">No categories yet.</p>}
      {error && (
        <p className="mt-3 text-[14px] text-expense" role="alert">
          {error}
        </p>
      )}
    </Card>
  )
}

function CategoryForm({
  type,
  initial,
  onSave,
  onCancel,
}: {
  type: TxType
  initial?: Category
  onSave: (name: string, color: string) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? SWATCHES[type === 'expense' ? 0 : 1])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = `cat-${initial?.id ?? 'new'}-${type}`

  return (
    <form
      className="mb-4 flex flex-col gap-4 rounded-card bg-raised p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return setError('Give the category a name.')
        setBusy(true)
        try {
          await onSave(name.trim(), color)
        } catch (err) {
          setError(friendlyError(err))
          setBusy(false)
        }
      }}
    >
      <Field label="Name" htmlFor={id}>
        <input id={id} autoFocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>
      <fieldset>
        <legend className="mb-2 text-[13px] font-[480] text-muted">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {SWATCHES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setColor(s)}
              aria-label={`Colour ${s}`}
              aria-pressed={color === s}
              className={cx('size-8 rounded-full ring-offset-2 ring-offset-raised transition', color === s && 'ring-2 ring-ink')}
              style={{ background: s }}
            />
          ))}
        </div>
      </fieldset>
      {error && (
        <p className="text-[14px] text-expense" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {initial ? 'Save' : 'Add category'}
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------

function download(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const csvCell = (v: string | number) => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function Backup({ tool }: { tool: Tool }) {
  const { transactions, categories, jobs } = useStore()
  const catName = new Map(categories.map((c) => [c.id, c.name]))

  const exportCsv = () => {
    const rows = [
      ['Date', 'Type', 'Category', 'Amount', 'Note'],
      ...transactions.map((t) => [t.date, t.type, catName.get(t.category_id ?? '') ?? '', t.amount, t.note ?? '']),
    ]
    download(`ledger-${todayISO()}.csv`, rows.map((r) => r.map(csvCell).join(',')).join('\n'), 'text/csv')
  }

  // Same columns as the original Google Sheet, so it can be pasted back there
  const exportJobsCsv = () => {
    const rows = [
      ['No', 'Posisi', 'Perusahaan', 'Lokasi', 'Kategori', 'Fleksibilitas', 'Status', 'Platform', 'Link', 'Gaji Min', 'Gaji Max', 'Tgl Apply', 'Catatan'],
      ...[...jobs].reverse().map((j, i) => [
        i + 1, j.position, j.company, j.location ?? '', CATEGORY[j.category], FLEXIBILITY[j.flexibility], STATUS[j.status].label,
        j.platform ?? '', j.link ?? '', j.salary_min ?? '', j.salary_max ?? '', j.applied_date, j.notes ?? '',
      ]),
    ]
    download(`job-applications-${todayISO()}.csv`, rows.map((r) => r.map(csvCell).join(',')).join('\n'), 'text/csv')
  }

  const exportJson = () =>
    download(
      `ledger-backup-${todayISO()}.json`,
      JSON.stringify({ exportedAt: new Date().toISOString(), categories, transactions, jobs }, null, 2),
      'application/json',
    )

  return (
    <Card>
      <CardTitle>Export</CardTitle>
      <p className="mb-5 max-w-[48ch] text-[14px] leading-[1.5] text-muted">
        Your data is stored online, but it is good to keep a copy. CSV opens in Excel or Google Sheets.
      </p>
      <div className="flex flex-wrap gap-3">
        {tool === 'budget' ? (
          <Button variant="ghost" onClick={exportCsv} disabled={!transactions.length}>
            <DownloadSimple size={16} /> Transactions (CSV)
          </Button>
        ) : (
          <Button variant="ghost" onClick={exportJobsCsv} disabled={!jobs.length}>
            <DownloadSimple size={16} /> Job applications (CSV)
          </Button>
        )}
        <Button variant="ghost" onClick={exportJson}>
          <DownloadSimple size={16} /> Full backup (JSON)
        </Button>
      </div>
    </Card>
  )
}

function Security() {
  const { changePin, lock } = useStore()
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const digits = (s: string) => s.replace(/\D/g, '').slice(0, 6)

  return (
    <Card>
      <CardTitle>Security</CardTitle>
      <form
        className="mb-6 flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (newPin.length !== 6) return setMsg({ ok: false, text: 'New PIN must be 6 digits.' })
          setBusy(true)
          try {
            await changePin(oldPin, newPin)
            setMsg({ ok: true, text: 'PIN updated.' })
            setOldPin('')
            setNewPin('')
          } catch (err) {
            setMsg({ ok: false, text: friendlyError(err) })
          } finally {
            setBusy(false)
          }
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Current PIN" htmlFor="old-pin">
            <input id="old-pin" type="password" inputMode="numeric" autoComplete="current-password" value={oldPin} onChange={(e) => setOldPin(digits(e.target.value))} className={inputClass} />
          </Field>
          <Field label="New PIN" htmlFor="new-pin">
            <input id="new-pin" type="password" inputMode="numeric" autoComplete="new-password" value={newPin} onChange={(e) => setNewPin(digits(e.target.value))} className={inputClass} />
          </Field>
        </div>
        {msg && (
          <p className={cx('text-[14px]', msg.ok ? 'text-income' : 'text-expense')} role="status">
            {msg.text}
          </p>
        )}
        <Button type="submit" variant="ghost" className="self-start" disabled={busy || oldPin.length !== 6}>
          Change PIN
        </Button>
      </form>
      <div className="border-t border-line pt-5">
        <Button variant="ghost" onClick={() => lock()}>
          <LockSimple size={16} /> Lock this device
        </Button>
      </div>
    </Card>
  )
}
