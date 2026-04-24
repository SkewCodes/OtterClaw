import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SecClawBridge } from "../events/secclaw-bridge.js";
import type { SecClawEvent, SecClawEventType } from "../events/secclaw-bridge.js";

function makeBridge(overrides?: Record<string, unknown>): SecClawBridge {
  return new SecClawBridge({
    transport: "http",
    endpoint: "http://127.0.0.1:9999/events",
    secret: "test-secret",
    manualFlush: true,
    onError: () => {},
    ...overrides,
  });
}

function makeEvent(overrides?: Partial<SecClawEvent>): SecClawEvent {
  return {
    type: "skill.cli.requested",
    skillId: "test-skill",
    timestamp: Date.now(),
    payload: { binary: "echo", args: ["hello"] },
    ...overrides,
  };
}

describe("SecClawBridge event types", () => {
  it("accepts lifecycle event types", () => {
    const lifecycleTypes: SecClawEventType[] = [
      "skill.uninstall",
      "skill.replaced",
      "skill.install.attempted",
      "skill.install.completed",
    ];
    const bridge = makeBridge();
    for (const type of lifecycleTypes) {
      bridge.emit(makeEvent({ type }));
    }
    const drained = bridge.drain();
    assert.equal(drained.length, lifecycleTypes.length);
  });
});

describe("SecClawBridge payload sanitization", () => {
  it("redacts args containing secret patterns", () => {
    const bridge = makeBridge();
    bridge.emit(makeEvent({
      payload: { binary: "curl", args: ["--header", "Authorization: Bearer my-secret-token"] },
    }));
    const drained = bridge.drain();
    assert.equal(drained.length, 1);
    const args = drained[0].payload.args as string[];
    assert.ok(args.some((a) => a === "[redacted]"));
  });

  it("truncates long args", () => {
    const bridge = makeBridge();
    const longArg = "a".repeat(500);
    bridge.emit(makeEvent({
      payload: { binary: "echo", args: [longArg] },
    }));
    const drained = bridge.drain();
    const args = drained[0].payload.args as string[];
    assert.ok(args[0].length < 500);
    assert.ok(args[0].endsWith("..."));
  });

  it("strips internalDetail from payload", () => {
    const bridge = makeBridge();
    bridge.emit(makeEvent({
      payload: { reason: "test", internalDetail: "http://internal.secclaw.local/path" },
    }));
    const drained = bridge.drain();
    assert.equal(drained[0].payload.internalDetail, undefined);
  });
});

describe("SecClawBridge buffer management", () => {
  it("drops oldest events when buffer exceeds size", () => {
    const bridge = makeBridge({ bufferSize: 3 });
    for (let i = 0; i < 5; i++) {
      bridge.emit(makeEvent({ payload: { index: i } }));
    }
    const drained = bridge.drain();
    assert.equal(drained.length, 3);
    assert.equal(drained[0].payload.index, 2);
  });

  it("drain returns all buffered events and clears buffer", () => {
    const bridge = makeBridge();
    bridge.emit(makeEvent());
    bridge.emit(makeEvent());
    const drained = bridge.drain();
    assert.equal(drained.length, 2);
    assert.equal(bridge.drain().length, 0);
  });
});

describe("SecClawBridge connectivity", () => {
  it("reports not connected initially", () => {
    const bridge = makeBridge();
    assert.ok(!bridge.isConnected());
  });
});
