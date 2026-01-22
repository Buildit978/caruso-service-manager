// frontend/src/utils/roleDetection.ts
// Utility to detect current user role from stored tokens (dev-only, deny-by-default)

import { getToken } from "../api/http";

const TOKEN_KEYS = {
  owner: "csm_token_owner",
  manager: "csm_token_manager",
  technician: "csm_token_technician",
} as const;

type Role = "owner" | "manager" | "technician" | undefined;

/**
 * Detects current user role by comparing active token with stored role tokens.
 * Returns undefined if role cannot be determined (deny-by-default).
 * This is a dev-only approach; in production, role would come from API/auth context.
 */
export function detectRole(): Role {
  const currentToken = getToken();
  if (!currentToken) {
    return undefined;
  }

  // Compare current token with stored role tokens
  const ownerToken = localStorage.getItem(TOKEN_KEYS.owner);
  const managerToken = localStorage.getItem(TOKEN_KEYS.manager);
  const technicianToken = localStorage.getItem(TOKEN_KEYS.technician);

  if (ownerToken && currentToken === ownerToken) {
    return "owner";
  }
  if (managerToken && currentToken === managerToken) {
    return "manager";
  }
  if (technicianToken && currentToken === technicianToken) {
    return "technician";
  }

  // Unknown role (deny-by-default)
  return undefined;
}
