// Random temporary-password generator for newly provisioned roster members.
// Avoids ambiguous characters (0/O, 1/I/l) so they're easy to read off a sheet.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function genTempPassword(len = 8) {
  let out = ''
  const arr = new Uint32Array(len)
  ;(crypto || window.crypto).getRandomValues(arr)
  for (let i = 0; i < len; i++) out += ALPHABET[arr[i] % ALPHABET.length]
  return out
}
