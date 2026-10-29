/**
 * title.ts
 *
 * Adds `/title [instructions]`, a manual alias for session titling that goes
 * beyond the built-in `/rename <title>`:
 *
 *   /title                       generate a title with the tiny model role,
 *                                using TITLE_SYSTEM.md and recent turns.
 *   /title fix-auth-token-bug    a single whitespace-free token containing a
 *                                dash is used verbatim as the title. No model
 *                                call.
 *   /title focus on the bug      any other argument is prose. A two-stage
 *                                tiny-model pipeline drafts content from the
 *                                prose, then reformats the draft under
 *                                TITLE_SYSTEM.md's rules.
 *
 * TITLE_SYSTEM.md discovery mirrors the documented contract in
 * omp://system-prompt-customization.md: project override at
 * `<cwd>/.omp/TITLE_SYSTEM.md`, else the active agent directory's
 * `TITLE_SYSTEM.md` (default `~/.omp/agent/TITLE_SYSTEM.md`, honoring
 * `PI_CODING_AGENT_DIR`/`PI_CONFIG_DIR`). Named profiles (`--profile`) are not
 * resolved here; the default-profile path is the only one this extension
 * checks.
 *
 * Every generated title (auto or two-stage) goes through the same
 * normalization contract OMP applies to its own title output: first trimmed
 * line, strip quotes/`<title>` markers/trailing punctuation, reject `none`
 * or output over 80 characters / 12 words. `pi.setSessionName()` always
 * records source "user" (the documented extension API has no "auto" path),
 * matching `/rename`'s behavior.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@oh-my-pi/pi-coding-agent";
import { completeSimple, type Context } from "@oh-my-pi/pi-ai";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const MAX_RECENT_USER_MESSAGES = 5;
const MAX_CHARS_PER_MESSAGE = 500;
const TITLE_MAX_OUTPUT_TOKENS = 128;
const DRAFT_MAX_OUTPUT_TOKENS = 200;

const FALLBACK_TITLE_SYSTEM_PROMPT =
  "Generate a short, specific session title (3 to 6 words) that names the primary objective. " +
  "Do not use punctuation other than spaces. Output only the title, nothing else.";

const DRAFT_SYSTEM_PROMPT =
  "Draft the core idea for a short session title. Follow the user's instructions below for what " +
  "to focus on. Output only the drafted idea in a few words, nothing else.";

// ─── TITLE_SYSTEM.md discovery ─────────────────────────────────────────────

// Default-profile agent dir; named profiles (`--profile`) are not resolved here.
const AGENT_DIR = process.env.PI_CODING_AGENT_DIR ?? path.join(os.homedir(), process.env.PI_CONFIG_DIR ?? ".omp", "agent");

async function readFirstExisting(paths: string[]): Promise<string | undefined> {
  for (const candidate of paths) {
    try {
      const text = (await fs.readFile(candidate, "utf8")).trim();
      if (text) return text;
    } catch {
      // Missing/unreadable — try the next candidate.
    }
  }
  return undefined;
}

async function loadTitleSystemPrompt(cwd: string): Promise<string> {
  const found = await readFirstExisting([
    path.join(cwd, ".omp", "TITLE_SYSTEM.md"),
    path.join(AGENT_DIR, "TITLE_SYSTEM.md"),
  ]);
  return found ?? FALLBACK_TITLE_SYSTEM_PROMPT;
}

// ─── Conversation context ───────────────────────────────────────────────────

/** Type guard for an assistant-message content block carrying visible text. */
function isTextBlock(block: unknown): block is { type: "text"; text: string } {
  if (!block || typeof block !== "object") return false;
  if (!("type" in block) || block.type !== "text") return false;
  return "text" in block && typeof block.text === "string";
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.filter(isTextBlock).map((block) => block.text).join(" ");
  }
  return "";
}

/** The last few user turns, each capped, newest last. Gives the tiny model
 *  enough of the session's arc without spending much context. */
function collectRecentUserText(ctx: ExtensionCommandContext): string {
  const userTexts: string[] = [];
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "message" && entry.message.role === "user") {
      const text = extractText(entry.message.content).trim();
      if (text) userTexts.push(text);
    }
  }
  return userTexts
    .slice(-MAX_RECENT_USER_MESSAGES)
    .map((text) => (text.length > MAX_CHARS_PER_MESSAGE ? `${text.slice(0, MAX_CHARS_PER_MESSAGE)}…` : text))
    .join("\n---\n");
}

// ─── Output normalization (matches OMP's own title contract) ──────────────

function normalizeGeneratedTitle(raw: string): string | undefined {
  // Some tiny-model responses lead with a blank line, or label the title
  // ("Title: fix-auth-bug") instead of emitting it bare. Skip to the first
  // non-empty line and drop a leading label before validating.
  const firstNonEmptyLine = raw.split("\n").map((line) => line.trim()).find((line) => line.length > 0) ?? "";
  let text = firstNonEmptyLine.replace(/^(?:session\s+)?title\s*:\s*/i, "").trim();
  if (/^<title\s*\/>$/i.test(text)) return undefined;
  const wrapped = text.match(/^<title>([\s\S]*?)<\/title>$/i);
  if (wrapped) text = wrapped[1]?.trim() ?? "";
  text = text.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
  text = text.replace(/[.!?,;:]+$/, "").trim();
  if (!text || text.toLowerCase() === "none") return undefined;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (text.length > 80 || wordCount > 12) return undefined;
  return text;
}

// ─── Tiny-model call ────────────────────────────────────────────────────────

async function runTinyCompletion(
  ctx: ExtensionCommandContext,
  systemPrompt: string,
  userText: string,
  maxTokens: number,
): Promise<string | undefined> {
  const model = ctx.models.resolve("@tiny");
  if (!model) {
    ctx.ui.notify("No 'tiny' model role is configured or available.", "error");
    return undefined;
  }
  const apiKey = await ctx.modelRegistry.getApiKey(model, ctx.sessionManager.getSessionId());
  const context: Context = {
    systemPrompt: [systemPrompt],
    messages: [{ role: "user", content: userText, timestamp: Date.now() }],
  };
  const message = await completeSimple(model, context, {
    apiKey,
    maxTokens,
    disableReasoning: true,
    cwd: ctx.cwd,
  });
  return extractText(message.content).trim() || undefined;
}

// ─── Command ────────────────────────────────────────────────────────────────

export default function titleCommand(pi: ExtensionAPI) {
  pi.registerCommand("title", {
    description:
      "Set the session title: no args generates one, a dashed-word sets it literally, prose guides generation.",
    handler: async (args, ctx) => {
      const trimmed = args.trim();
      const isDashWord = trimmed.length > 0 && !/\s/.test(trimmed) && trimmed.includes("-");

      if (isDashWord) {
        await pi.setSessionName(trimmed);
        ctx.ui.notify(`Session title set to "${trimmed}".`, "info");
        return;
      }

      // The tiny-model round trip below can take anywhere from a couple of
      // seconds to over a minute. Without an immediate status update, the
      // command looks like a no-op until it finishes (or the user gives up).
      // setWorkingMessage only attaches to an already-running loading
      // animation; while idle (the common case for this command) it is a
      // silent no-op. setStatus renders in the footer unconditionally.
      ctx.ui.setStatus("title", "Generating title…");
      try {
        const titleSystemPrompt = await loadTitleSystemPrompt(ctx.cwd);
        const recentContext = collectRecentUserText(ctx) || "(no user messages yet)";

        let finalRaw: string | undefined;
        if (trimmed === "") {
          finalRaw = await runTinyCompletion(ctx, titleSystemPrompt, recentContext, TITLE_MAX_OUTPUT_TOKENS);
        } else {
          const draft = await runTinyCompletion(
            ctx,
            DRAFT_SYSTEM_PROMPT,
            `Instructions: ${trimmed}\n\nConversation context:\n${recentContext}`,
            DRAFT_MAX_OUTPUT_TOKENS,
          );
          if (draft === undefined) return;
          finalRaw = await runTinyCompletion(ctx, titleSystemPrompt, draft, TITLE_MAX_OUTPUT_TOKENS);
        }

        if (finalRaw === undefined) {
          ctx.ui.notify("Title generation produced no usable output.", "warning");
          return;
        }
        const title = normalizeGeneratedTitle(finalRaw);
        if (!title) {
          const preview = finalRaw.length > 60 ? `${finalRaw.slice(0, 60)}…` : finalRaw;
          ctx.ui.notify(`Title generation output failed validation. Model said: "${preview}"`, "warning");
          return;
        }
        await pi.setSessionName(title);
        ctx.ui.notify(`Session title set to "${title}".`, "info");
      } finally {
        ctx.ui.setStatus("title", undefined);
      }
    },
  });
}
