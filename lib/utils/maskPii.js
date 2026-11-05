/** Keep customer addresses out of logs while the domain stays useful for support. */
export function maskEmail(value) {
  if (Array.isArray(value)) return value.map(maskEmail).join(', ');
  if (typeof value !== 'string' || !value.includes('@')) return value ? '***' : '(none)';
  const address = value.match(/<([^>]+)>/)?.[1] || value;
  const [local, domain] = address.split('@');
  return `${local.charAt(0)}***@${domain}`;
}
