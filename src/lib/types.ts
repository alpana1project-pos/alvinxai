export type Section = "overview" | "alvin" | "finance" | "ideas" | "notes" | "tasks" | "settings";

export type Item = {
  id: string;
  user_id: string;
  content: string;
  item_type: "inbox" | "note" | "idea" | "task" | "finance" | "other";
  status: "pending" | "processed" | "archived";
  source: string;
  ai_confidence: number | null;
  ai_reason: string | null;
  metadata: Record<string, unknown>;
  processed_at: string | null;
  created_at: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};