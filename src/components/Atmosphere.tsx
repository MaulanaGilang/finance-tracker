/** Blurred light sources behind the app plus a film-grain layer above it. Orb colors follow the active tool. */
export function Atmosphere() {
  return (
    <>
      <div className="ambient" aria-hidden>
        <div className="orb drift" style={{ width: 620, height: 620, left: '-12%', top: '-18%', backgroundColor: 'var(--orb-1)', opacity: 0.9 }} />
        <div className="orb drift-slow" style={{ width: 520, height: 520, right: '-10%', top: '8%', backgroundColor: 'var(--orb-2)', opacity: 0.85 }} />
        <div className="orb drift" style={{ width: 560, height: 560, left: '30%', bottom: '-30%', backgroundColor: 'var(--orb-3)', opacity: 0.7 }} />
      </div>
      <div className="grain" aria-hidden />
    </>
  )
}
