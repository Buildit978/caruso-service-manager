/**
 * Client-side search for founding partner list views (Partner portal + Admin).
 * Case-insensitive partial match across business and interaction text fields.
 */
export interface FoundingPartnerListSearchFields {
  businessName?: string | null;
  ownerName?: string | null;
  primaryContact?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  website?: string | null;
  notes?: string | null;
  interactionNotes?: string | null;
}

export function normalizeFoundingPartnerListSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function getFoundingPartnerListSearchHaystack(
  fields: FoundingPartnerListSearchFields
): string {
  return [
    fields.businessName,
    fields.ownerName,
    fields.primaryContact,
    fields.phone,
    fields.email,
    fields.address,
    fields.website,
    fields.notes,
    fields.interactionNotes,
  ]
    .map((value) => (value != null ? String(value).trim() : ""))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function matchesFoundingPartnerListSearch(
  query: string,
  fields: FoundingPartnerListSearchFields
): boolean {
  const normalized = normalizeFoundingPartnerListSearchQuery(query);
  if (!normalized) return true;
  return getFoundingPartnerListSearchHaystack(fields).includes(normalized);
}

export function filterFoundingPartnerListItems<T>(
  items: T[],
  query: string,
  toSearchFields: (item: T) => FoundingPartnerListSearchFields
): T[] {
  const normalized = normalizeFoundingPartnerListSearchQuery(query);
  if (!normalized) return items;
  return items.filter((item) => matchesFoundingPartnerListSearch(normalized, toSearchFields(item)));
}
