import { execFile } from "child_process";
import { promisify } from "util";
import type { ModelInfo } from "@/lib/types";
import { serverError, safeErrorMessage } from "@/lib/errors";
import { MODELS_CACHE_TTL_MS, MODELS_FETCH_TIMEOUT_MS } from "@/lib/constants";
import { getConfig } from "@/lib/session-store";
import { agentEnv, classifyAgentStartError, resolveAgentBin } from "@/lib/cursor-cli";
import { parseModels } from "@/lib/models";

const execFileAsync = promisify(execFile);

export const dynamic = "force-dynamic";

let cachedModels: { models: ModelInfo[]; fetchedAt: number } | null = null;

export async function GET() {
  if (cachedModels && Date.now() - cachedModels.fetchedAt < MODELS_CACHE_TTL_MS) {
    return Response.json({ models: cachedModels.models });
  }

  try {
    if (process.env.CLR_VERBOSE === "1") {
      console.warn(`[models] fetching (timeout=${MODELS_FETCH_TIMEOUT_MS}ms)`);
    }

    const agentArgs = ["models"];
    const trustEnv = process.env.CURSOR_TRUST;
    const trustConfig = trustEnv === "0" ? false : trustEnv === "1" ? true : (await getConfig("trust")) !== "0";
    if (trustConfig) agentArgs.push("--trust");

    const { stdout } = await execFileAsync(resolveAgentBin(), agentArgs, {
      encoding: "utf-8",
      timeout: MODELS_FETCH_TIMEOUT_MS,
      env: agentEnv(),
    });

    const parsed = parseModels(stdout);
    const models: ModelInfo[] = [];

    if (parsed.length > 0) {
      if (!parsed.some((m) => m.id === "auto")) {
        models.push({
          id: "auto",
          label: "Auto",
          isDefault: false,
          isCurrent: false,
        });
      }
      models.push(...parsed);
      cachedModels = { models, fetchedAt: Date.now() };
    }

    return Response.json({ models });
  } catch (err) {
    safeErrorMessage(err, "Failed to fetch models");
    const stderr =
      err && typeof err === "object" && "stderr" in err ? String((err as { stderr: unknown }).stderr) : "";
    return serverError(classifyAgentStartError(stderr, false));
  }
}
