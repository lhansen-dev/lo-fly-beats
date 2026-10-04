export function relativeLuminance(hex: string): number {
  const value = hex.replace(/^#/, '')
  const channels = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16) / 255)
  const linear = channels.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

export function readCssColor(css: string, name: string): string {
  const match = css.match(new RegExp(`--${name}\\s*:\\s*(#[\\da-fA-F]{6})\\s*;`))
  if (!match) throw new Error(`CSS color --${name} not found`)
  return match[1]
}
