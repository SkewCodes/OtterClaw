import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  findCliCapability,
  isEgressAllowed,
  isFileReadAllowed,
  isFileWriteAllowed,
  isEnvReadAllowed,
  isEnvDenied,
} from "../schema/skill-frontmatter.js";
import type { SkillCapabilities } from "../schema/skill-frontmatter.js";

describe("findCliCapability", () => {
  const caps: SkillCapabilities = {
    cli: [
      { binary: "orderly", subcommands: ["symbols", "market-list"] },
      { binary: "curl", subcommands: ["-s"] },
    ],
  };

  it("returns matching capability", () => {
    const cap = findCliCapability(caps, "orderly", "symbols");
    assert.ok(cap);
    assert.equal(cap.binary, "orderly");
  });

  it("returns undefined for undeclared binary", () => {
    assert.equal(findCliCapability(caps, "wget", "get"), undefined);
  });

  it("returns undefined for undeclared subcommand", () => {
    assert.equal(findCliCapability(caps, "orderly", "order-place"), undefined);
  });

  it("returns undefined when no capabilities", () => {
    assert.equal(findCliCapability(undefined, "orderly", "symbols"), undefined);
  });
});

describe("isEgressAllowed", () => {
  const caps: SkillCapabilities = {
    network: { egress: ["api.orderly.org", "api.coingecko.com"] },
  };

  it("allows declared host", () => {
    assert.ok(isEgressAllowed(caps, "api.orderly.org"));
  });

  it("blocks undeclared host", () => {
    assert.ok(!isEgressAllowed(caps, "evil.com"));
  });

  it("blocks when no network caps", () => {
    assert.ok(!isEgressAllowed({}, "api.orderly.org"));
  });
});

describe("isFileReadAllowed", () => {
  const caps: SkillCapabilities = {
    filesystem: {
      read: ["./config/*", "./data/**"],
      denied: ["~/.ssh/**", "**/.env*"],
    },
  };

  it("allows matching read path", () => {
    assert.ok(isFileReadAllowed(caps, "./config/settings.json"));
  });

  it("blocks denied path even if read matches", () => {
    assert.ok(!isFileReadAllowed(caps, "~/.ssh/id_rsa"));
  });

  it("blocks undeclared path", () => {
    assert.ok(!isFileReadAllowed(caps, "/etc/passwd"));
  });

  it("blocks path traversal via ..", () => {
    assert.ok(!isFileReadAllowed(caps, "./config/../../.env"));
  });

  it("blocks bare .. path", () => {
    assert.ok(!isFileReadAllowed(caps, ".."));
  });

  it("blocks nested traversal", () => {
    assert.ok(!isFileReadAllowed(caps, "./data/../../../etc/passwd"));
  });
});

describe("isFileWriteAllowed", () => {
  const caps: SkillCapabilities = {
    filesystem: {
      write: ["./output/*"],
      denied: ["~/.ssh/**", "**/.env*"],
    },
  };

  it("allows matching write path", () => {
    assert.ok(isFileWriteAllowed(caps, "./output/result.json"));
  });

  it("blocks denied path", () => {
    assert.ok(!isFileWriteAllowed(caps, "~/.ssh/authorized_keys"));
  });

  it("blocks traversal in write path", () => {
    assert.ok(!isFileWriteAllowed(caps, "./output/../../.env"));
  });
});

describe("isEnvReadAllowed", () => {
  const caps: SkillCapabilities = {
    env: {
      reads: ["API_KEY", "NODE_ENV"],
      denied: ["AWS_*"],
    },
  };

  it("allows declared reads", () => {
    assert.ok(isEnvReadAllowed(caps, "API_KEY"));
  });

  it("blocks undeclared var", () => {
    assert.ok(!isEnvReadAllowed(caps, "SECRET_TOKEN"));
  });

  it("blocks denied var", () => {
    assert.ok(!isEnvReadAllowed(caps, "AWS_SECRET_KEY"));
  });
});

describe("isEnvDenied", () => {
  const caps: SkillCapabilities = {
    env: { denied: ["AWS_*", "AZURE_*"] },
  };

  it("denies matching wildcard", () => {
    assert.ok(isEnvDenied(caps, "AWS_ACCESS_KEY_ID"));
  });

  it("does not deny non-matching var", () => {
    assert.ok(!isEnvDenied(caps, "NODE_ENV"));
  });

  it("handles undefined capabilities", () => {
    assert.ok(!isEnvDenied(undefined, "AWS_ACCESS_KEY_ID"));
  });
});
