// Server-only helper for calling Lovable AI Gateway
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type Msg = {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
};

export async function aiComplete(opts: {
  model?: string;
  messages: Msg[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
}): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const body: Record<string, unknown> = {
    model: opts.model ?? "google/gemini-3-flash-preview",
    messages: opts.messages,
    temperature: opts.temperature ?? 0.8,
    max_tokens: opts.maxTokens ?? 400,
  };
  if (opts.json) body.response_format = { type: "json_object" };
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("AI rate limit — încearcă în câteva secunde.");
    if (res.status === 402) throw new Error("Credite AI epuizate. Adaugă credite în workspace.");
    throw new Error(`AI error ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}
