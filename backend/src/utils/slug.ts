/**
 * Generate a URL-safe, unique slug for Account.slug (Shop Code)
 * Format: lowercase, alphanumeric + hyphens, 12-16 chars
 */
export function generateShopCode(): string {
  const length = 12;
  const charset = "abcdefghijklmnopqrstuvwxyz0123456789";
  let slug = "";
  
  // Start with a letter (not a number) for better readability
  slug += charset.charAt(Math.floor(Math.random() * 26));
  
  // Fill the rest randomly
  for (let i = 1; i < length; i++) {
    slug += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  return slug;
}
