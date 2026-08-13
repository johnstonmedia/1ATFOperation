// Pure helpers over an intel fragment. Kept out of the components so React Fast
// Refresh stays happy (a module mixing a component export with a plain function
// export forces a full page reload on every edit during dev).

// A one-line "what's attached" summary for list rows — lets an approver see a
// submission carries a handout without opening it.
export function attachmentSummary(fragment) {
  const res = fragment?.resources || []
  const bits = []
  if (String(fragment?.docUrl || '').trim()) bits.push('📄 document')
  const imgs = res.filter((r) => r.type === 'image').length
  const links = res.length - imgs
  if (imgs) bits.push(`🖼 ${imgs} image${imgs > 1 ? 's' : ''}`)
  if (links) bits.push(`🔗 ${links} link${links > 1 ? 's' : ''}`)
  if (String(fragment?.hint || '').trim()) bits.push('💡 hint')
  return bits.join(' · ')
}
