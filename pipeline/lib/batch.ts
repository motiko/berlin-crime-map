/**
 * OpenRouter Batch API: about half the per-token price, results within 24 hours.
 * Docs: https://openrouter.ai/docs/batch-quickstart
 *
 * A batch is POSTed as JSON (no file upload). Results arrive in the GET response once
 * the batch is completed, in any order, matched back by custom_id. Cost is reported
 * for the whole batch, not per request.
 */
import type { RawReport } from '../../shared/types.ts';
import { type ChatResponse, HEADERS, MODEL, chatBody } from './extraction.ts';

const BATCHES = 'https://openrouter.ai/api/v1/batches';

export type BatchStatus = 'validating' | 'in_progress' | 'finalizing' | 'completed' | 'failed' | 'expired' | 'cancelled';

export interface BatchResultItem {
  custom_id: string;
  response?: { status_code: number; body: ChatResponse };
  error?: { message?: string; code?: string };
}

export interface Batch {
  id: string;
  status: BatchStatus;
  request_counts?: Record<string, number>;
  results?: BatchResultItem[] | null;
  usage?: { prompt_tokens: number; completion_tokens: number; cost: number };
  expires_at?: string;
  errors?: unknown;
}

export const FINAL: BatchStatus[] = ['completed', 'failed', 'expired', 'cancelled'];

async function call<T>(url: string, apiKey: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: HEADERS(apiKey) });
  const text = await res.text();
  if (!res.ok) throw new Error(`OpenRouter batches ${res.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text) as T;
}

export function submitBatch(reports: RawReport[], apiKey: string): Promise<Batch> {
  // The API stream-parses the body: endpoint and model must come before requests.
  const body =
    `{"endpoint":"/v1/chat/completions","model":${JSON.stringify(MODEL)},"completion_window":"24h","requests":` +
    JSON.stringify(reports.map((r) => ({ custom_id: r.id, body: chatBody(r) }))) +
    '}';
  return call<Batch>(BATCHES, apiKey, { method: 'POST', body });
}

export function getBatch(id: string, apiKey: string): Promise<Batch> {
  return call<Batch>(`${BATCHES}/${id}`, apiKey);
}
