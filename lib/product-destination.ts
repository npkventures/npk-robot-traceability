// Only existing product destinations may survive authentication. Never accept an origin.
export function productDestination(value: unknown): string {
  if (typeof value !== 'string' || value.length > 512 || !/^\/app(?:\?|$)/.test(value)) return '/app';
  const input = new URL(value, 'https://destination.invalid');
  const result = new URLSearchParams();
  const org = input.searchParams.get('org');
  if (org && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(org)) result.set('org', org);
  return '/app' + (result.size ? '?' + result : '');
}
