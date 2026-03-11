import test from "node:test";
import assert from "node:assert/strict";

import { parseChatArgs } from "../src/commands/agent-chat.js";
import { buildChatUrl, extractText, sendChatRequest } from "../src/api/agent-chat.js";

const originalFetch = globalThis.fetch;

test("parseChatArgs requires agent_id", () => {
  assert.throws(
    () => parseChatArgs([]),
    /Missing agent_id/
  );
  assert.throws(
    () => parseChatArgs(["-m", "hello"]),
    /Missing agent_id/
  );
});

test("parseChatArgs extracts agent_id as first positional", () => {
  const args = parseChatArgs(["01KFT0E68A1RES94ZV6DA131X4"]);
  assert.equal(args.agentId, "01KFT0E68A1RES94ZV6DA131X4");
  assert.equal(args.message, undefined);
  assert.equal(args.verbose, false);
});

test("parseChatArgs -m sets message for non-interactive mode", () => {
  const args = parseChatArgs(["agent-123", "-m", "hello world"]);
  assert.equal(args.agentId, "agent-123");
  assert.equal(args.message, "hello world");
});

test("parseChatArgs --conversation-id and --session-id are equivalent", () => {
  const a = parseChatArgs(["agent-123", "--conversation-id", "conv_abc"]);
  const b = parseChatArgs(["agent-123", "--session-id", "conv_abc"]);
  assert.equal(a.conversationId, "conv_abc");
  assert.equal(b.conversationId, "conv_abc");
});

test("parseChatArgs --stream and --no-stream set stream flag", () => {
  const withStream = parseChatArgs(["agent-123", "--stream"]);
  const noStream = parseChatArgs(["agent-123", "--no-stream"]);
  assert.equal(withStream.stream, true);
  assert.equal(noStream.stream, false);
});

test("parseChatArgs --verbose sets verbose", () => {
  const args = parseChatArgs(["agent-123", "--verbose"]);
  assert.equal(args.verbose, true);
});

test("parseChatArgs parses combined flags", () => {
  const args = parseChatArgs([
    "agent-xyz",
    "-m",
    "query text",
    "--conversation-id",
    "conv_123",
    "--no-stream",
    "--verbose",
  ]);
  assert.equal(args.agentId, "agent-xyz");
  assert.equal(args.message, "query text");
  assert.equal(args.conversationId, "conv_123");
  assert.equal(args.stream, false);
  assert.equal(args.verbose, true);
});

test("buildChatUrl constructs correct endpoint", () => {
  const url = buildChatUrl("https://dip.aishu.cn", "01KFT0E68A1RES94ZV6DA131X4");
  assert.equal(
    url,
    "https://dip.aishu.cn/api/agent-app/v1/app/01KFT0E68A1RES94ZV6DA131X4/api/chat/completion"
  );
});

test("buildChatUrl strips trailing slashes from baseUrl", () => {
  const url = buildChatUrl("https://dip.aishu.cn/", "agent-id");
  assert.equal(url, "https://dip.aishu.cn/api/agent-app/v1/app/agent-id/api/chat/completion");
});

test("extractText prefers final_answer.answer.text", () => {
  const data = {
    final_answer: {
      answer: { text: "Final answer text" },
    },
  };
  assert.equal(extractText(data), "Final answer text");
});

test("extractText falls back to message.content.text", () => {
  const data = {
    message: {
      content: { text: "Message text" },
    },
  };
  assert.equal(extractText(data), "Message text");
});

test("extractText returns empty for empty or invalid input", () => {
  assert.equal(extractText(null), "");
  assert.equal(extractText(undefined), "");
  assert.equal(extractText({}), "");
});

test("sendChatRequest returns text and conversation_id from JSON response", async () => {
  globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : {};
    assert.equal(body.agent_id, "agent-xyz");
    assert.equal(body.query, "hello");
    assert.equal(body.stream, false);
    return new Response(
      JSON.stringify({
        conversation_id: "conv_123",
        final_answer: { answer: { text: "Hello back!" } },
      }),
      { headers: { "content-type": "application/json" } }
    );
  };
  try {
    const result = await sendChatRequest({
      baseUrl: "https://dip.aishu.cn",
      accessToken: "token-abc",
      agentId: "agent-xyz",
      query: "hello",
      stream: false,
    });
    assert.equal(result.text, "Hello back!");
    assert.equal(result.conversationId, "conv_123");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sendChatRequest includes conversation_id in body when provided", async () => {
  globalThis.fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}");
    assert.equal(body.conversation_id, "conv_existing");
    return new Response(
      JSON.stringify({
        conversation_id: "conv_existing",
        final_answer: { answer: { text: "Continued." } },
      }),
      { headers: { "content-type": "application/json" } }
    );
  };
  try {
    const result = await sendChatRequest({
      baseUrl: "https://dip.aishu.cn",
      accessToken: "token-abc",
      agentId: "agent-xyz",
      query: "continue",
      conversationId: "conv_existing",
      stream: false,
    });
    assert.equal(result.text, "Continued.");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sendChatRequest throws on HTTP error", async () => {
  globalThis.fetch = async () =>
    new Response("Unauthorized", { status: 401, statusText: "Unauthorized" });
  try {
    await assert.rejects(
      async () =>
        sendChatRequest({
          baseUrl: "https://dip.aishu.cn",
          accessToken: "bad",
          agentId: "agent-xyz",
          query: "hi",
          stream: false,
        }),
      /HTTP 401/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
