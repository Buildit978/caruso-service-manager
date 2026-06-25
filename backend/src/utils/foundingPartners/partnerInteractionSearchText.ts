type InteractionNoteForSearch = {
  summary?: string;
  primaryContact?: string;
  amendments?: Array<{ text?: string }>;
};

/** Concatenates interaction fields used for client-side list search. */
export function buildPartnerInteractionSearchText(notes: InteractionNoteForSearch[]): string {
  const parts: string[] = [];
  for (const note of notes) {
    if (note.primaryContact?.trim()) parts.push(note.primaryContact.trim());
    if (note.summary?.trim()) parts.push(note.summary.trim());
    for (const amendment of note.amendments ?? []) {
      if (amendment.text?.trim()) parts.push(amendment.text.trim());
    }
  }
  return parts.join(" ");
}
