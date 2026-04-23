import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { IncomingMessage } from "node:http";

export type SecClawEventType =
  | "skill.install.attempted"
  | "skill.install.completed"
  | "skill.invocation.started"
  | "skill.cli.requested"
  | "skill.cli.blocked"
  | "skill.network.requested"
  | "skill.capability.violation";

export interface SecClawEvent {
  type: SecClawEventType;
  skillId: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

export type TransportKind = "http" | "unix";

export interface SecClawBridgeConfig {
  transport: TransportKind;
  /** For http: "http://127.0.0.1:PORT/path". For unix: socket file path. */
  endpoint: string;
  /** Shared secret loaded at boot for authenticating events. */
  secret: string;
  /** Max events to buffer before dropping oldest. Default 1000. */
  bufferSize?: number;
  /** Fire-and-forget: don't await delivery. Default true. */
  async?: boolean;
  /** Request timeout in ms. Default 5000. */
  timeoutMs?: number;
  /** Called when flush fails (instead of silently swallowing). */
  onError?: (err: Error) => void;
}

const DEFAULT_BUFFER_SIZE = 1000;
const DEFAULT_TIMEOUT_MS = 5000;

export class SecClawBridge {
  private config: SecClawBridgeConfig;
  private buffer: SecClawEvent[] = [];
  private connected = false;
  private flushing = false;

  constructor(config: SecClawBridgeConfig) {
    this.config = config;
  }

  emit(event: SecClawEvent): void {
    this.buffer.push(event);
    if (this.buffer.length > (this.config.bufferSize ?? DEFAULT_BUFFER_SIZE)) {
      this.buffer.shift();
    }

    this.flushLoop().catch((err: unknown) => {
      this.config.onError?.(
        err instanceof Error ? err : new Error(String(err)),
      );
    });
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    if (this.flushing) return;

    this.flushing = true;
    const batch = this.buffer.splice(0);

    try {
      await this.send(batch);
      this.connected = true;
    } catch (err) {
      this.connected = false;
      this.buffer.unshift(...batch);
      throw err;
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Flush in a loop until the buffer is empty. Prevents events pushed
   * during an in-flight flush from being stranded.
   */
  private async flushLoop(): Promise<void> {
    if (this.flushing) return;
    while (this.buffer.length > 0) {
      await this.flush();
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  drain(): SecClawEvent[] {
    return this.buffer.splice(0);
  }

  private send(events: SecClawEvent[]): Promise<void> {
    if (this.config.transport === "http") {
      return this.sendHttp(events);
    }
    if (this.config.transport === "unix") {
      return this.sendUnix(events);
    }
    return Promise.reject(
      new Error(`Unknown transport: ${this.config.transport as string}`),
    );
  }

  private sendHttp(events: SecClawEvent[]): Promise<void> {
    const body = JSON.stringify(events);
    const url = new URL(this.config.endpoint);
    const isHttps = url.protocol === "https:";
    const defaultPort = isHttps ? "443" : "80";
    const doRequest = isHttps ? httpsRequest : httpRequest;
    const timeoutMs = this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    return new Promise<void>((resolve, reject) => {
      const req = doRequest(
        {
          hostname: url.hostname,
          port: url.port || defaultPort,
          path: url.pathname + url.search,
          method: "POST",
          timeout: timeoutMs,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
            Authorization: `Bearer ${this.config.secret}`,
          },
        },
        (res: IncomingMessage) => {
          collectResponse(res, resolve, reject);
        },
      );

      req.on("timeout", () => {
        req.destroy(new Error(`SecClaw request timed out after ${timeoutMs}ms`));
      });
      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }

  private sendUnix(events: SecClawEvent[]): Promise<void> {
    const body = JSON.stringify(events);
    const timeoutMs = this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    return new Promise<void>((resolve, reject) => {
      const req = httpRequest(
        {
          socketPath: this.config.endpoint,
          path: "/events",
          method: "POST",
          timeout: timeoutMs,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
            Authorization: `Bearer ${this.config.secret}`,
          },
        },
        (res: IncomingMessage) => {
          collectResponse(res, resolve, reject);
        },
      );

      req.on("timeout", () => {
        req.destroy(new Error(`SecClaw request timed out after ${timeoutMs}ms`));
      });
      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }
}

function collectResponse(
  res: IncomingMessage,
  resolve: () => void,
  reject: (err: Error) => void,
): void {
  let data = "";
  res.on("data", (chunk: Buffer | string) => {
    data += chunk;
    if (data.length > 64 * 1024) {
      res.destroy(new Error("SecClaw response too large"));
    }
  });
  res.on("end", () => {
    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
      resolve();
    } else {
      reject(new Error(`SecClaw responded ${res.statusCode}: ${data}`));
    }
  });
  res.on("error", reject);
}
