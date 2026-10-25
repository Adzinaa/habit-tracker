// Replays reference_recording.jsonl against an API and reports every difference.
//
//   npm run replay                       # against http://localhost:3001
//   npm run replay -- http://host:port   # against another server
//
// The target must be empty: the script starts with POST /test/reset. Ids are compared as
// they are (q1, c1, ...), because this API numbers them the same way the old one did.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export interface RecordedRequest {
  x_now: string;
  method: string;
  path: string;
  body?: unknown;
  status: number;
  response?: unknown;
}

export interface SentRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: unknown;
}

/** `body` is undefined when the response had no body (e.g. 204). */
export interface ReceivedResponse {
  status: number;
  body: unknown;
}

export type Send = (request: SentRequest) => Promise<ReceivedResponse>;

export interface Mismatch {
  line: number;
  request: string;
  problem: string;
}

export const DEFAULT_RECORDING = fileURLToPath(new URL("../tests/fixtures/reference_recording.jsonl", import.meta.url));

export function readRecording(path: string = DEFAULT_RECORDING): RecordedRequest[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as RecordedRequest);
}

export async function replay(recording: RecordedRequest[], send: Send): Promise<Mismatch[]> {
  const mismatches: Mismatch[] = [];

  for (const [index, recorded] of recording.entries()) {
    const received = await send({
      method: recorded.method,
      path: recorded.path,
      headers: { "X-Now": recorded.x_now },
      body: recorded.body,
    });

    const problem = compare(recorded, received);
    if (problem) {
      mismatches.push({ line: index + 1, request: `${recorded.method} ${recorded.path} @ ${recorded.x_now}`, problem });
    }
  }
  return mismatches;
}

function compare(recorded: RecordedRequest, received: ReceivedResponse): string | null {
  if (received.status !== recorded.status) {
    return `status ${received.status}, expected ${recorded.status}. Body: ${JSON.stringify(received.body)}`;
  }
  try {
    assert.deepStrictEqual(received.body, recorded.response); // both undefined when there is no body
    return null;
  } catch (error) {
    return `body differs\n${(error as Error).message}`;
  }
}

// ---- command line ---------------------------------------------------------

async function sendOverHttp(baseUrl: string, request: SentRequest): Promise<ReceivedResponse> {
  const headers: Record<string, string> = { ...request.headers };
  if (request.body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(baseUrl + request.path, {
    method: request.method,
    headers,
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
  });
  const text = await response.text();
  return { status: response.status, body: text === "" ? undefined : JSON.parse(text) };
}

async function main() {
  const baseUrl = (process.argv[2] ?? "http://localhost:3001").replace(/\/$/, "");
  const recording = readRecording();

  const reset = await sendOverHttp(baseUrl, { method: "POST", path: "/test/reset", headers: {} });
  if (reset.status !== 204) throw new Error(`POST /test/reset answered ${reset.status}`);

  const mismatches = await replay(recording, (request) => sendOverHttp(baseUrl, request));

  for (const { line, request, problem } of mismatches) {
    console.error(`line ${line}: ${request}\n  ${problem}\n`);
  }
  console.log(`${recording.length - mismatches.length}/${recording.length} requests match the recording (${baseUrl})`);
  process.exit(mismatches.length === 0 ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
