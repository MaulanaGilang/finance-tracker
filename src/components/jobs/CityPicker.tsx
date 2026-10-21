import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { CaretDown, MapPin, X } from '@phosphor-icons/react'
import { REGIONS } from '../../lib/regions'
import { cx, inputClass } from '../ui'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
/** "Kota Bandung" -> "bandung": people type the place, not its kind */
const bare = (name: string) => norm(name).replace(/^(kota|kabupaten) /, '')
const INDEX = REGIONS.map(([name, province]) => ({ name, province, key: bare(name), prov: norm(province) }))

/** Best matches first: the place's name starting with the query, then any word in it, then anywhere, then the province */
function search(query: string) {
  const q = norm(query).replace(/^(kota|kab(upaten)?\.?) /, '')
  if (!q) return INDEX
  const scored: { item: (typeof INDEX)[number]; score: number }[] = []
  for (const item of INDEX) {
    const score = item.key.startsWith(q) ? 0 : item.key.split(' ').some((w) => w.startsWith(q)) ? 1 : item.key.includes(q) ? 2 : item.prov.includes(q) ? 3 : -1
    if (score >= 0) scored.push({ item, score })
  }
  // On a tie the city (kota) comes before the regency (kabupaten) of the same name: it's usually the one meant
  const kota = (n: string) => (n.startsWith('Kota') ? 0 : 1)
  return scored.sort((a, b) => a.score - b.score || a.item.key.length - b.item.key.length || kota(a.item.name) - kota(b.item.name)).map((s) => s.item)
}

/**
 * Searchable dropdown of every Indonesian regency and city. Only places from the list can be picked;
 * a location saved before the list existed is kept and shown until you choose another.
 */
export function CityPicker({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const legacy = value && !INDEX.some((r) => r.name === value) ? value : null
  const results = useMemo(() => search(query).slice(0, 60), [query])
  const options = legacy && !query ? [{ name: legacy, province: 'Saved earlier', key: '', prov: '' }, ...results] : results

  const pick = (name: string) => {
    onChange(name)
    setOpen(false)
    setQuery('')
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) return setOpen(true)
      setActive((i) => Math.max(0, Math.min(options.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && options[active]) pick(options[active].name)
    } else if (e.key === 'Escape' && open) {
      // Close the list only, not the whole sheet behind it
      e.stopPropagation()
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div className="relative">
      <MapPin size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={open ? query : value}
        placeholder={open && value ? value : 'Search a city or regency'}
        onFocus={() => {
          setOpen(true)
          setActive(0)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onBlur={() => {
          // Typing alone never sets the location: it has to be picked from the list (or cleared with the x)
          setOpen(false)
          setQuery('')
        }}
        onKeyDown={onKey}
        className={cx(inputClass, 'pl-11 pr-10')}
      />
      {value && !open ? (
        <button type="button" aria-label="Clear location" onClick={() => onChange('')} className="absolute right-2.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-ink">
          <X size={14} />
        </button>
      ) : (
        <CaretDown size={13} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted" />
      )}
      {open && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-[calc(100%+6px)] z-10 max-h-64 overflow-y-auto rounded-[16px] border border-line bg-card p-1.5 shadow-[0_12px_32px_-12px_rgba(28,33,30,0.25)]">
          {options.length ? (
            options.map((o, i) => (
              <li
                key={o.name + i}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.name === value}
                // mousedown, not click: the input's blur would close the list before a click lands
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(o.name)
                }}
                onMouseEnter={() => setActive(i)}
                className={cx('flex cursor-pointer items-baseline justify-between gap-3 rounded-[10px] px-3 py-2 text-[14px]', i === active && 'bg-raised', o.name === value && 'font-[480] text-accent')}
              >
                <span className="truncate">{o.name}</span>
                <span className="shrink-0 text-[12px] text-muted">{o.province}</span>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-[14px] text-muted">No city or regency matches "{query}"</li>
          )}
        </ul>
      )}
    </div>
  )
}
