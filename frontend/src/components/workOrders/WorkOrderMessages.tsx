// frontend/src/components/workOrders/WorkOrderMessages.tsx
import { useState, useEffect } from "react";
import {
  fetchWorkOrderMessages,
  postWorkOrderMessage,
} from "../../api/workOrderMessages";
import type { WorkOrderMessage } from "../../types/workOrderMessage";
import type { HttpError } from "../../api/http";

interface WorkOrderMessagesProps {
  workOrderId: string;
}

type MessageTab = "internal" | "customer";

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

// Helper to determine visibility from message (supports legacy channel field)
function getMessageVisibility(msg: WorkOrderMessage): "internal" | "customer" {
  return msg.visibility || msg.channel || "internal";
}

export default function WorkOrderMessages({ workOrderId }: WorkOrderMessagesProps) {
  const [messages, setMessages] = useState<WorkOrderMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [newMessageBody, setNewMessageBody] = useState("");
  const [activeTab, setActiveTab] = useState<MessageTab>("internal");
  const [canPostCustomer, setCanPostCustomer] = useState<boolean | null>(null); // null = unknown

  async function loadMessages() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchWorkOrderMessages(workOrderId);
      // Sort by createdAt ascending
      const sorted = [...data].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      setMessages(sorted);
    } catch (err: any) {
      console.error("[WorkOrderMessages] Failed to load messages", err);
      setError(err?.data?.message || err?.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId]);

  async function handlePostMessage() {
    const body = newMessageBody.trim();
    if (!body) {
      alert("Message body is required");
      return;
    }

    // Technicians always post internal only
    const visibility = activeTab === "customer" ? "customer" : "internal";

    try {
      setPosting(true);
      setError(null);

      const newMessage = await postWorkOrderMessage(workOrderId, {
        body,
        visibility,
        channel: visibility, // legacy support
      });

      // Append the returned message to the list (no optimistic updates)
      setMessages((prev) => [...prev, newMessage].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ));

      setNewMessageBody("");
      
      // If successfully posted customer message, mark capability
      if (visibility === "customer") {
        setCanPostCustomer(true);
      }
    } catch (err: any) {
      console.error("[WorkOrderMessages] Failed to post message", err);
      const httpError = err as HttpError;
      
      // If 403 on customer message, mark as not allowed
      if (httpError.status === 403 && activeTab === "customer") {
        setCanPostCustomer(false);
        setError("You don't have permission to post customer-facing messages.");
      } else {
        setError(err?.data?.message || err?.message || "Failed to post message");
      }
    } finally {
      setPosting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Cmd/Ctrl + Enter to send
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handlePostMessage();
    }
  }

  if (loading) {
    return (
      <div style={{ padding: "1rem", border: "1px solid #eee", borderRadius: "12px" }}>
        <p>Loading messages...</p>
      </div>
    );
  }

  // Filter messages by active tab
  const filteredMessages = messages.filter((msg) => {
    const visibility = getMessageVisibility(msg);
    return activeTab === "internal" ? visibility !== "customer" : visibility === "customer";
  });

  // Detect if user can post customer messages (server-proven)
  // If no customer messages exist and we haven't tested, assume they might be able to
  const hasCustomerMessages = messages.some((msg) => getMessageVisibility(msg) === "customer");
  const showCustomerTab = canPostCustomer !== false || hasCustomerMessages;

  return (
    <div
      style={{
        marginTop: "1.5rem",
        border: "1px solid #eee",
        borderRadius: "12px",
        padding: "1rem",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Messages</h3>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", borderBottom: "1px solid #e5e7eb" }}>
        <button
          type="button"
          onClick={() => setActiveTab("internal")}
          style={{
            padding: "0.5rem 1rem",
            border: "none",
            borderBottom: activeTab === "internal" ? "2px solid #1d4ed8" : "2px solid transparent",
            background: "transparent",
            color: activeTab === "internal" ? "#1d4ed8" : "#6b7280",
            fontWeight: activeTab === "internal" ? 600 : 400,
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          Internal
        </button>
        {showCustomerTab && (
          <button
            type="button"
            onClick={() => setActiveTab("customer")}
            disabled={canPostCustomer === false}
            style={{
              padding: "0.5rem 1rem",
              border: "none",
              borderBottom: activeTab === "customer" ? "2px solid #1d4ed8" : "2px solid transparent",
              background: "transparent",
              color: activeTab === "customer" ? "#1d4ed8" : canPostCustomer === false ? "#9ca3af" : "#6b7280",
              fontWeight: activeTab === "customer" ? 600 : 400,
              cursor: canPostCustomer === false ? "not-allowed" : "pointer",
              fontSize: "0.9rem",
              opacity: canPostCustomer === false ? 0.6 : 1,
            }}
          >
            Customer
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.5rem 0.75rem",
            borderRadius: "0.5rem",
            border: "1px solid #fecaca",
            background: "#fee2e2",
            color: "#7f1d1d",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Messages list */}
      <div style={{ marginBottom: "1rem", maxHeight: "400px", overflowY: "auto" }}>
        {filteredMessages.length === 0 ? (
          <p style={{ color: "#6b7280", fontStyle: "italic" }}>
            No {activeTab} messages yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {filteredMessages.map((msg) => {
              const visibility = getMessageVisibility(msg);
              return (
                <div
                  key={msg._id}
                  style={{
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: "1px solid #1f2937",
                    background: "#111827",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, color: "#e5e7eb" }}>
                        {msg.actor.nameSnapshot || "Unknown User"}
                      </span>
                      <span
                        style={{
                          marginLeft: "0.5rem",
                          fontSize: "0.85rem",
                          color: "#9ca3af",
                        }}
                      >
                        ({formatRole(msg.actor.roleSnapshot)})
                      </span>
                      {visibility === "customer" && (
                        <span
                          style={{
                            marginLeft: "0.5rem",
                            fontSize: "0.75rem",
                            padding: "0.15rem 0.4rem",
                            borderRadius: "4px",
                            background: "#fbbf24",
                            color: "#78350f",
                            fontWeight: 600,
                          }}
                        >
                          Customer
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
                      {formatTimestamp(msg.createdAt)}
                    </span>
                  </div>
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: "1.5", color: "#e5e7eb", fontSize: "1rem" }}>
                    {msg.body}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Post new message */}
      <div
        style={{
          borderTop: "1px solid #1f2937",
          paddingTop: "1rem",
        }}
      >
        <style>{`
          .message-compose-textarea::placeholder {
            color: #9ca3af;
            opacity: 1;
          }
        `}</style>
        {/* Visibility toggle - only show if can post customer or unknown */}
        {canPostCustomer !== false && (
          <div style={{ marginBottom: "0.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", color: "#e5e7eb" }}>
              <input
                type="radio"
                checked={activeTab === "internal"}
                onChange={() => setActiveTab("internal")}
                style={{ cursor: "pointer" }}
              />
              Internal
            </label>
            {showCustomerTab && (
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", marginLeft: "1rem", color: "#e5e7eb" }}>
                <input
                  type="radio"
                  checked={activeTab === "customer"}
                  onChange={() => setActiveTab("customer")}
                  disabled={!(canPostCustomer === true)}
                  style={{ cursor: !(canPostCustomer === true) ? "not-allowed" : "pointer" }}
                />
                Customer
              </label>
            )}
          </div>
        )}

        {(() => {
          const canPost = canPostCustomer === true;
          return (
            <>
              <textarea
                value={newMessageBody}
                onChange={(e) => setNewMessageBody(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message... (Cmd/Ctrl + Enter to send)"
                disabled={posting || (activeTab === "customer" && !canPost)}
                style={{
                  width: "100%",
                  minHeight: "80px",
                  padding: "0.5rem 0.6rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #1f2937",
                  background: "#111827",
                  color: "#e5e7eb",
                  fontSize: "0.9rem",
                  resize: "vertical",
                  fontFamily: "inherit",
                  cursor: posting || (activeTab === "customer" && !canPost) ? "not-allowed" : "text",
                }}
                className="message-compose-textarea"
              />

              <div style={{ marginTop: "0.5rem", display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={handlePostMessage}
                  disabled={posting || !newMessageBody.trim() || (activeTab === "customer" && !canPost)}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "0.375rem",
                    border: "1px solid #1d4ed8",
                    background: posting || !newMessageBody.trim() || (activeTab === "customer" && !canPost) ? "#9ca3af" : "#1d4ed8",
                    color: "#ffffff",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    cursor: posting || !newMessageBody.trim() || (activeTab === "customer" && !canPost) ? "default" : "pointer",
                  }}
                >
                  {posting ? "Posting..." : "Post Message"}
                </button>
              </div>
            </>
          );
        })()}

        <p style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.25rem" }}>
          Tip: Press Cmd/Ctrl + Enter to send
        </p>
      </div>
    </div>
  );
}
