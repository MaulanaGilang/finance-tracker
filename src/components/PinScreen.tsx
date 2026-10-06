import { useCallback, useEffect, useState } from 'react'
import { motion, useAnimate } from 'motion/react'
import { Backspace } from '@phosphor-icons/react'
import { EASE_OUT } from '../lib/motion'
import { friendlyError } from '../lib/api'
import { useStore } from '../lib/store'
import { Logo } from './AppShell'
import { Button, cx } from './ui'

const LEN = 6

export function PinScreen() {
  const { status, setupPin, unlock, reload } = useStore()
  const isSetup = status === 'setup'

  const [pin, setPin] = useState('')
  const [firstPin, setFirstPin] = useState<string | null>(null) // setup: first entry awaiting confirmation
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dotsRef, animateDots] = useAnimate<HTMLDivElement>()

  // Wrong PIN / mismatch: the dots shake side to side, like a head shake
  useEffect(() => {
    if (error && dotsRef.current) animateDots(dotsRef.current, { x: [0, -10, 10, -7, 7, -3, 0] }, { duration: 0.45 })
  }, [error, animateDots, dotsRef])

  const submit = useCallback(
    async (value: string) => {
      setError(null)
      if (isSetup && firstPin === null) {
        setFirstPin(value)
        setPin('')
        return
      }
      if (isSetup && value !== firstPin) {
        setError('PINs did not match. Start again.')
        setFirstPin(null)
        setPin('')
        return
      }
      setBusy(true)
      try {
        if (isSetup) await setupPin(value)
        else if (!(await unlock(value))) setError('Wrong PIN. Try again.')
      } catch (e) {
        setError(friendlyError(e))
      } finally {
        setBusy(false)
        setPin('')
      }
    },
    [isSetup, firstPin, setupPin, unlock],
  )

  const press = useCallback(
    (d: string) => {
      if (busy) return
      setError(null)
      setPin((p) => (p.length >= LEN ? p : p + d))
    },
    [busy],
  )
  const back = useCallback(() => setPin((p) => p.slice(0, -1)), [])

  // Submit shortly after the last digit so the final dot visibly fills first.
  useEffect(() => {
    if (pin.length !== LEN) return
    const t = setTimeout(() => submit(pin), 120)
    return () => clearTimeout(t)
  }, [pin, submit])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press, back])

  if (status === 'offline') {
    return (
      <Centered>
        <h1 className="font-display text-[28px]">Can't reach your data</h1>
        <p className="max-w-[32ch] text-center text-[15px] leading-[1.5] text-muted">
          Check your internet connection, then try again.
        </p>
        <Button variant="primary" onClick={() => reload()}>
          Try again
        </Button>
      </Centered>
    )
  }

  if (status === 'checking') {
    return (
      <Centered>
        <div className="skeleton h-8 w-40" />
      </Centered>
    )
  }

  const title = isSetup ? (firstPin === null ? 'Create a 6-digit PIN' : 'Confirm your PIN') : 'Enter your PIN'
  const subtitle = isSetup
    ? 'You will use this PIN to open your ledger on any device.'
    : 'Your ledger is locked on this device.'

  return (
    <Centered>
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="font-display text-[26px] leading-[1.2] sm:text-[28px]">{title}</h1>
        <p className="max-w-[30ch] text-[15px] leading-[1.5] text-muted">{subtitle}</p>
      </div>

      <div ref={dotsRef} className="flex gap-3.5" aria-label={`${pin.length} of ${LEN} digits entered`} role="status">
        {Array.from({ length: LEN }, (_, i) => {
          const filled = i < pin.length
          return (
            <motion.span
              key={i}
              // Each dot pops slightly as it fills
              animate={{ scale: filled ? [1, 1.35, 1] : 1 }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
              className={cx(
                'size-3.5 rounded-full border transition-colors duration-150',
                filled ? 'border-forest bg-forest' : 'border-line-strong bg-transparent',
              )}
            />
          )
        })}
      </div>

      <p className={cx('h-5 text-[14px] text-expense', !error && 'invisible')} role="alert">
        {error ?? ' '}
      </p>

      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Key key={d} onClick={() => press(d)} disabled={busy}>
            {d}
          </Key>
        ))}
        <span />
        <Key onClick={() => press('0')} disabled={busy}>
          0
        </Key>
        <button
          onClick={back}
          aria-label="Delete digit"
          className="flex size-[72px] items-center justify-center rounded-full text-muted transition-colors hover:bg-raised active:scale-95"
        >
          <Backspace size={24} />
        </button>
      </div>
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-7 px-4 py-10">
      <div className="mb-2">
        <Logo />
      </div>
      {children}
    </div>
  )
}

function Key({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className="frost flex size-[72px] items-center justify-center rounded-full border border-white/80 ring-1 ring-line/60 font-display text-[24px] tabular-nums transition-[background-color,transform] hover:bg-raised active:scale-95 disabled:opacity-50"
    >
      {children}
    </button>
  )
}
