import { useMemo, useState, type FormEvent } from 'react'
import { AnimatePresence } from 'motion/react'
import { Ghost, Info } from '@phosphor-icons/react'
import { friendlyError } from '../../lib/api'
import { formatNumber, parseAmount, todayISO } from '../../lib/format'
import {
  CATEGORY,
  FLEXIBILITY,
  GHOST_DAYS,
  STATUS,
  STATUS_ORDER,
  daysUntilGhost,
  isWaiting,
  type JobCategory,
  type JobFlexibility,
  type JobStatus,
} from '../../lib/jobs'
import { useStore } from '../../lib/store'
import { Sheet } from '../Sheet'
import { Button, Field, Segmented, cx, inputClass, selectClass } from '../ui'
import { StatusRing } from './Status'

const PLATFORMS = ['LinkedIn', 'Glints', 'Kalibrr', 'Dealls', 'JobStreet', 'Indeed', 'Instagram', 'Company website', 'Referral']

export function JobComposer() {
  const { jobComposer, closeJobComposer } = useStore()
  return (
    <AnimatePresence>
      {jobComposer.open && <JobSheet key={jobComposer.editing?.id ?? 'new'} onClose={closeJobComposer} />}
    </AnimatePresence>
  )
}

function JobSheet({ onClose }: { onClose: () => void }) {
  const { jobComposer, jobs, saveJob, deleteJob } = useStore()
  const editing = jobComposer.editing

  const [position, setPosition] = useState(editing?.position ?? '')
  const [company, setCompany] = useState(editing?.company ?? '')
  const [status, setStatus] = useState<JobStatus>(editing?.status ?? 'applied')
  const [category, setCategory] = useState<JobCategory>(editing?.category ?? 'full_time')
  const [flexibility, setFlexibility] = useState<JobFlexibility>(editing?.flexibility ?? 'onsite')
  const [location, setLocation] = useState(editing?.location ?? '')
  const [platform, setPlatform] = useState(editing?.platform ?? '')
  const [link, setLink] = useState(editing?.link ?? '')
  const [salaryMin, setSalaryMin] = useState(editing?.salary_min ? formatNumber(editing.salary_min) : '')
  const [salaryMax, setSalaryMax] = useState(editing?.salary_max ? formatNumber(editing.salary_max) : '')
  const [appliedDate, setAppliedDate] = useState(editing?.applied_date ?? todayISO())
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Suggestions drawn from what you've used before
  const platforms = useMemo(() => [...new Set([...jobs.map((j) => j.platform).filter(Boolean), ...PLATFORMS])] as string[], [jobs])
  const locations = useMemo(() => [...new Set(jobs.map((j) => j.location).filter(Boolean))] as string[], [jobs])

  const statusChanged = editing && status !== editing.status
  const ghostIn = editing && !statusChanged ? daysUntilGhost(editing) : isWaiting(status) ? GHOST_DAYS : null

  const money = (s: string, set: (v: string) => void) => {
    const n = parseAmount(s)
    set(n ? formatNumber(n) : '')
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!position.trim() || !company.trim()) return setError('Position and company are required.')
    const min = parseAmount(salaryMin) || null
    const max = parseAmount(salaryMax) || null
    if (min && max && min > max) return setError('Minimum salary is higher than the maximum.')
    setBusy(true)
    setError(null)
    try {
      await saveJob({
        id: editing?.id,
        position: position.trim(),
        company: company.trim(),
        location: location.trim(),
        category,
        flexibility,
        status,
        platform: platform.trim(),
        link: link.trim(),
        salary_min: min,
        salary_max: max,
        applied_date: appliedDate,
        notes,
      })
      onClose()
    } catch (err) {
      setError(friendlyError(err))
      setBusy(false)
    }
  }

  async function remove() {
    if (!editing || !confirm(`Delete ${editing.position} at ${editing.company}?`)) return
    setBusy(true)
    try {
      await deleteJob(editing.id)
      onClose()
    } catch (err) {
      setError(friendlyError(err))
      setBusy(false)
    }
  }

  return (
    <Sheet title={editing ? 'Edit application' : 'New application'} onClose={onClose} onSubmit={save} maxWidth="sm:max-w-[560px]">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Position" htmlFor="j-position">
            <input id="j-position" autoFocus={!editing} required value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Data Engineer" className={inputClass} />
          </Field>
          <Field label="Company" htmlFor="j-company">
            <input id="j-company" required value={company} onChange={(e) => setCompany(e.target.value)} placeholder="PT Contoh Indonesia" className={inputClass} />
          </Field>
        </div>

        <Field label="Status" htmlFor="j-status">
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
              <StatusRing status={status} />
            </span>
            <select id="j-status" value={status} onChange={(e) => setStatus(e.target.value as JobStatus)} className={cx(selectClass, 'pl-11')}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS[s].label}
                </option>
              ))}
            </select>
          </div>
        </Field>

        {/* Ghost rule context */}
        {editing?.auto_ghosted && editing.status === 'ghosted' && !statusChanged ? (
          <p className="flex gap-2.5 rounded-card bg-raised/80 px-4 py-3 text-[13px] leading-[1.5] text-muted">
            <Ghost size={18} className="mt-px shrink-0" />
            Marked ghosted automatically after {GHOST_DAYS} days with no update. If they got back to you, pick the new status.
          </p>
        ) : ghostIn !== null ? (
          <p className="-mt-2 flex items-center gap-2 text-[13px] text-muted">
            <Info size={15} />
            {statusChanged || !editing
              ? `Will be marked ghosted if nothing changes for ${GHOST_DAYS} days.`
              : ghostIn === 0
                ? 'Will be marked ghosted on the next refresh.'
                : `Marked ghosted in ${ghostIn} ${ghostIn === 1 ? 'day' : 'days'} unless the status changes.`}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-[480] text-muted">Category</span>
            <Segmented label="Category" value={category} onChange={setCategory} className="w-full" options={(Object.keys(CATEGORY) as JobCategory[]).map((k) => ({ value: k, label: CATEGORY[k] }))} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-[480] text-muted">Flexibility</span>
            <Segmented label="Flexibility" value={flexibility} onChange={setFlexibility} className="w-full" options={(Object.keys(FLEXIBILITY) as JobFlexibility[]).map((k) => ({ value: k, label: FLEXIBILITY[k] }))} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Location" htmlFor="j-location">
            <input id="j-location" list="j-locations" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Jakarta Selatan" className={inputClass} />
            <datalist id="j-locations">{locations.map((l) => <option key={l} value={l} />)}</datalist>
          </Field>
          <Field label="Platform" htmlFor="j-platform">
            <input id="j-platform" list="j-platforms" value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="LinkedIn" className={inputClass} />
            <datalist id="j-platforms">{platforms.map((p) => <option key={p} value={p} />)}</datalist>
          </Field>
        </div>

        <Field label="Job link" htmlFor="j-link">
          <input id="j-link" type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" className={inputClass} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Salary min (Rp / month)" htmlFor="j-smin">
            <input id="j-smin" inputMode="numeric" value={salaryMin} onChange={(e) => money(e.target.value, setSalaryMin)} placeholder="7.000.000" className={cx(inputClass, 'tabular-nums')} />
          </Field>
          <Field label="Salary max" htmlFor="j-smax">
            <input id="j-smax" inputMode="numeric" value={salaryMax} onChange={(e) => money(e.target.value, setSalaryMax)} placeholder="9.000.000" className={cx(inputClass, 'tabular-nums')} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_1fr]">
          <Field label="Applied on" htmlFor="j-date">
            <input id="j-date" type="date" required value={appliedDate} onChange={(e) => setAppliedDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Notes (optional)" htmlFor="j-notes">
            <input id="j-notes" value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} placeholder="Recruiter name, next step..." className={inputClass} />
          </Field>
        </div>

        <p className={cx('min-h-5 text-[14px] text-expense', !error && 'invisible')} role="alert">
          {error ?? ' '}
        </p>

        <div className="flex gap-3">
          {editing && (
            <Button type="button" variant="danger" onClick={remove} disabled={busy}>
              Delete
            </Button>
          )}
          <Button type="submit" variant="primary" className="flex-1" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Add application'}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
