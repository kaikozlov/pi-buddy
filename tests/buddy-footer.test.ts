import { beforeAll, describe, expect, test } from "bun:test";
import {
  initTheme,
  type ExtensionContext,
  type ModelRuntime,
  type ReadonlyFooterDataProvider,
} from "@earendil-works/pi-coding-agent";
import { BuddyPiFooter } from "../src/buddy-footer.ts";

const model = {
  id: "test-model",
  provider: "test-provider",
  reasoning: false,
  contextWindow: 128_000,
};

function makeContext(): ExtensionContext {
  return {
    model,
    sessionManager: {
      getEntries: () => [],
      getCwd: () => "/tmp/pi-buddy",
      getSessionName: () => undefined,
    },
    getContextUsage: () => ({ tokens: 0, contextWindow: model.contextWindow, percent: 0 }),
  } as unknown as ExtensionContext;
}

function makeModelRuntime(usingOAuth: boolean): ModelRuntime {
  return {
    isUsingOAuth(provider: string) {
      expect(provider).toBe(model.provider);
      return usingOAuth;
    },
  } as ModelRuntime;
}

const footerData = {
  getGitBranch: () => null,
  getExtensionStatuses: () => new Map<string, string>(),
  getAvailableProviderCount: () => 1,
  onBranchChange: () => () => {},
} as ReadonlyFooterDataProvider;

describe("BuddyPiFooter", () => {
  beforeAll(() => initTheme("dark"));

  test("passes the current ModelRuntime shape to FooterComponent", () => {
    const footer = new BuddyPiFooter(makeModelRuntime(true), footerData, makeContext, () => "buddy");

    const lines = footer.render(80);

    expect(lines.join("\n")).toContain("$0.000 (sub)");
    expect(lines[0]).toContain("buddy");
  });

  test("omits the subscription marker for API-key authentication", () => {
    const footer = new BuddyPiFooter(makeModelRuntime(false), footerData, makeContext, () => undefined);

    expect(footer.render(120).join("\n")).not.toContain("(sub)");
  });
});
