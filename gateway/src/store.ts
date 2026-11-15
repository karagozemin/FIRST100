import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ExecutionRecord } from "./types.js";

interface Challenge {
  orderId: string;
  buyer: string;
  value: string;
  expiresAt: number;
}

interface StoreData {
  challenges: Record<string, Challenge>;
  executions: Record<string, ExecutionRecord>;
}

export interface GatewayStore {
  issueChallenge?(orderId: string, buyer: string, expiresAt: number): Promise<string>;
  putChallenge(challenge: Challenge): Promise<void>;
  consumeChallenge(orderId: string, buyer: string, value: string): Promise<boolean>;
  getExecution(orderId: string): Promise<ExecutionRecord | undefined>;
  putExecution(record: ExecutionRecord): Promise<void>;
}

/**
 * Stateless challenge storage for horizontally scaled runtimes. The 32-byte
 * NEP-413 nonce carries an expiry, entropy, and an HMAC bound to order + buyer.
 * Onchain order state remains the execution lock and accounting authority.
 */
export class SignedChallengeStore implements GatewayStore {
  constructor(private readonly secret: string) {
    if (secret.length < 32) throw new Error("challenge secret must be at least 32 characters");
  }

  async issueChallenge(orderId: string, buyer: string, expiresAt: number): Promise<string> {
    const expiry = Buffer.alloc(8);
    expiry.writeBigUInt64BE(BigInt(expiresAt));
    const entropy = randomBytes(16);
    const payload = Buffer.concat([expiry, entropy]);
    const mac = this.mac(orderId, buyer, payload).subarray(0, 8);
    return Buffer.concat([payload, mac]).toString("base64");
  }

  async putChallenge(): Promise<void> {
    // issueChallenge returns a self-authenticating nonce, so no write is needed.
  }

  async consumeChallenge(orderId: string, buyer: string, value: string): Promise<boolean> {
    try {
      const token = Buffer.from(value, "base64");
      if (token.length !== 32) return false;
      const payload = token.subarray(0, 24);
      const received = token.subarray(24);
      const expected = this.mac(orderId, buyer, payload).subarray(0, 8);
      const expiresAt = Number(payload.readBigUInt64BE(0));
      return expiresAt >= Date.now() && timingSafeEqual(received, expected);
    } catch {
      return false;
    }
  }

  async getExecution(): Promise<ExecutionRecord | undefined> {
    return undefined;
  }

  async putExecution(): Promise<void> {
    // The delivery transition on NEAR is the durable single-execution boundary.
  }

  private mac(orderId: string, buyer: string, payload: Buffer): Buffer {
    return createHmac("sha256", this.secret)
      .update(orderId)
      .update("\0")
      .update(buyer)
      .update("\0")
      .update(payload)
      .digest();
  }
}

export class JsonGatewayStore implements GatewayStore {
  private data: StoreData = { challenges: {}, executions: {} };
  private loaded = false;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly file: string) {}

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      this.data = JSON.parse(await readFile(this.file, "utf8")) as StoreData;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    await writeFile(temporary, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    await rename(temporary, this.file);
  }

  private mutate(operation: () => void): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      await this.load();
      operation();
      await this.persist();
    });
    return this.writeQueue;
  }

  async putChallenge(challenge: Challenge): Promise<void> {
    return this.mutate(() => {
      this.data.challenges[challenge.orderId] = challenge;
    });
  }

  async consumeChallenge(orderId: string, buyer: string, value: string): Promise<boolean> {
    let accepted = false;
    await this.mutate(() => {
      const challenge = this.data.challenges[orderId];
      accepted = Boolean(
        challenge &&
          challenge.buyer === buyer &&
          challenge.value === value &&
          challenge.expiresAt >= Date.now(),
      );
      if (accepted) delete this.data.challenges[orderId];
    });
    return accepted;
  }

  async getExecution(orderId: string): Promise<ExecutionRecord | undefined> {
    await this.load();
    return this.data.executions[orderId];
  }

  async putExecution(record: ExecutionRecord): Promise<void> {
    return this.mutate(() => {
      if (this.data.executions[record.orderId]) throw new Error("execution already exists");
      this.data.executions[record.orderId] = record;
    });
  }
}

export class MemoryGatewayStore implements GatewayStore {
  private readonly challenges = new Map<string, Challenge>();
  private readonly executions = new Map<string, ExecutionRecord>();

  async putChallenge(challenge: Challenge): Promise<void> {
    this.challenges.set(challenge.orderId, challenge);
  }
  async consumeChallenge(orderId: string, buyer: string, value: string): Promise<boolean> {
    const challenge = this.challenges.get(orderId);
    const valid = Boolean(
      challenge && challenge.buyer === buyer &&
        challenge.value === value && challenge.expiresAt >= Date.now(),
    );
    if (valid) this.challenges.delete(orderId);
    return valid;
  }
  async getExecution(orderId: string): Promise<ExecutionRecord | undefined> {
    return this.executions.get(orderId);
  }
  async putExecution(record: ExecutionRecord): Promise<void> {
    if (this.executions.has(record.orderId)) throw new Error("execution already exists");
    this.executions.set(record.orderId, record);
  }
}
