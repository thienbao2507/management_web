import { useBackground } from "@/context/BackgroundContext"

export function AppBackground() {
  const { background } = useBackground()

  if (!background) return null

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <img
        src={background.image}
        alt=""
        decoding="async"
        className="h-full w-full object-cover"
      />
      <div
        className="absolute inset-0 bg-background"
        style={{ opacity: background.dim / 100 }}
      />
    </div>
  )
}
