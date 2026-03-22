export function usePriceLevel() {
  function priceLabel(level) {
    if (level === 1) return '$'
    if (level === 2) return '$$'
    if (level === 3) return '$$$'
    return ''
  }
  return { priceLabel }
}
