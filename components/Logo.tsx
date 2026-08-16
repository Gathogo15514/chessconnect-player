import Image from "next/image"

// Single source of truth for the ChessLead brand mark, mirrored from the
// main site's components/layout/Logo.tsx. The asset is a dark "CL" monogram
// + gold crown/wordmark on a transparent background, so any consumer on a
// dark surface must pass `chip` to get a light background island behind it
// -- otherwise the dark linework disappears into the page.
const INTRINSIC_WIDTH  = 1024
const INTRINSIC_HEIGHT = 1024

interface LogoProps {
  /** Rendered height in px; width follows automatically to preserve aspect ratio. */
  height?: number
  /** Wrap the mark in a light rounded badge -- required on dark backgrounds. */
  chip?: boolean
  /** Chip box size in px (defaults to height + padding). Only used when chip is true. */
  chipSize?: number
  className?: string
}

export function Logo({ height = 32, chip = false, chipSize, className }: LogoProps) {
  const image = (
    <Image
      src="/logo-chesslead.png"
      alt="ChessLead"
      width={INTRINSIC_WIDTH}
      height={INTRINSIC_HEIGHT}
      priority
      style={{ height, width: "auto" }}
      className={chip ? undefined : className}
    />
  )

  if (!chip) return image

  const box = chipSize ?? height + 14

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: box,
        height: box,
        borderRadius: box * 0.25,
        background: "#F7F3EC",
        flexShrink: 0,
      }}
    >
      {image}
    </span>
  )
}
