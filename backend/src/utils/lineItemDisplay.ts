export type LineItemType = "labour" | "part" | "service";

const TYPE_PREFIX_RE = /^(part|labour|service)\s*:/i;

export function formatLineItemTypeLabel(type?: string): string {
  switch (type) {
    case "labour":
      return "Labour";
    case "part":
      return "Part";
    case "service":
      return "Service";
    default:
      return "";
  }
}

export function formatLineItemDescriptionForDisplay(args: {
  type?: string;
  description?: string;
}): string {
  const description = String(args.description ?? "").trim();
  const typeLabel = formatLineItemTypeLabel(args.type);

  if (!typeLabel) {
    return description;
  }

  if (!description) {
    return typeLabel;
  }

  if (TYPE_PREFIX_RE.test(description)) {
    return description;
  }

  return `${typeLabel}: ${description}`;
}
