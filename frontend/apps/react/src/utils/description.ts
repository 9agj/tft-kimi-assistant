interface Curved {
  desc?: string
  curveTable?: Record<string, number[][]>
  attributeValues?: Record<string, number[]>
}

export function resolveDescription(record: Curved | undefined, star = 1) {
  if (!record) return ''
  let desc = record.desc ?? ''
  desc = desc.replace(/<TFTCurveTable\b([^>]*)\/?>/gi, (_match, attributes: string) => {
    const row = attributes.match(/\brow="([^"]+)"/i)?.[1] ?? ''
    const pairs = record.curveTable?.[row] ?? []
    const exact = pairs.find(pair => pair[0] === star)
    const value = exact?.[1] ?? pairs[0]?.[1]
    if (value === undefined) return '（随条件变化）'
    const format = attributes.match(/\bformat="([^"]+)"/i)?.[1]
    if (format === 'percent') return `${Math.round(value * 10000) / 100}%`
    if (format === 'percentMinusOne') return `${Math.round((value - 1) * 10000) / 100}%`
    return String(Math.round(value * 100) / 100)
  })
  desc = desc.replace(/<TFTAttribute\b([^>]*)\/?>/gi, (_match, attributes: string) => {
    const id = attributes.match(/\battributeId="([^"]+)"/i)?.[1] ?? ''
    const values = record.attributeValues?.[id]
    const value = values?.length === 1 ? values[0] : values?.[Math.max(0, star - 1)]
    if (value === undefined) return '（战斗中变化）'
    const format = attributes.match(/\bformat="([^"]+)"/i)?.[1]
    return format === 'percent' ? `${Math.round(value * 10000) / 100}%` : String(Math.round(value * 100) / 100)
  })
  return desc.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/\{[^}]+\}/g, '（动态效果）').replace(/@[^@]+@/g, '（动态效果）').trim()
}
