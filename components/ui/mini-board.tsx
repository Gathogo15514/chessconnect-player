export function MiniBoard({ className }: { className?: string }) {
  const squares = Array.from({ length: 64 }, (_, i) => {
    const row = Math.floor(i / 8)
    const col = i % 8
    return (row + col) % 2 === 0
  })

  return (
    <div
      className={
        "grid aspect-square w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-[10px] border border-brand-border " +
        (className ?? "")
      }
    >
      {squares.map((light, i) => (
        <div key={i} className={light ? "bg-secondary" : "bg-primary"} />
      ))}
    </div>
  )
}
