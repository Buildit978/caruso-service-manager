type AutomationPayload = Record<string, unknown>;

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Fail-open Make webhook sender.
 * Never throws; logs and returns on any delivery/config error.
 */
export async function sendAutomationWebhook(
  eventType: string,
  payload: AutomationPayload
): Promise<void> {
  const url = process.env.MAKE_WEBHOOK_URL;
  if (!url) return;

  const secret = process.env.MAKE_WEBHOOK_SECRET;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (secret) {
      headers["x-make-signature"] = secret;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        eventType,
        occurredAt: new Date().toISOString(),
        payload,
      }),
    });

    if (!response.ok) {
      console.error("[automationWebhook] non-2xx response", {
        eventType,
        status: response.status,
      });
    }
  } catch (err) {
    console.error("[automationWebhook] delivery failed", {
      eventType,
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    clearTimeout(timeout);
  }
}
