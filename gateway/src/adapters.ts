import type { NearChain } from "./chain.js";
import { researchNearAccount } from "./service.js";
import type { ResearchRequest, ResearchResult } from "./types.js";

export interface ServiceContext {
  orderId: string;
  seriesId: string;
  serviceId: string;
}

export interface ServiceDescriptor {
  id: string;
  version: string;
  title: string;
  requestSchema: Record<string, unknown>;
  metering: "per-call";
  source: string;
}

export interface ServiceAdapter<TRequest extends object, TResult> {
  descriptor: ServiceDescriptor;
  execute(request: TRequest, context: ServiceContext): Promise<TResult>;
}

export class ServiceRegistry {
  private readonly adapters = new Map<string, ServiceAdapter<object, unknown>>();

  register<TRequest extends object, TResult>(
    adapter: ServiceAdapter<TRequest, TResult>,
    aliases: string[] = [],
  ): this {
    for (const id of [adapter.descriptor.id, ...aliases]) {
      if (this.adapters.has(id)) throw new Error(`service adapter already registered: ${id}`);
      this.adapters.set(id, adapter as ServiceAdapter<object, unknown>);
    }
    return this;
  }

  list(): ServiceDescriptor[] {
    return [...new Map([...this.adapters.values()].map((adapter) => [adapter.descriptor.id, adapter.descriptor])).values()];
  }

  async execute(serviceId: string, request: object, context: ServiceContext): Promise<unknown> {
    const adapter = this.adapters.get(serviceId);
    if (!adapter) throw new Error(`service adapter is not configured: ${serviceId}`);
    return adapter.execute(request, context);
  }
}

const accountRequestSchema = {
  type: "object",
  required: ["accountId"],
  additionalProperties: false,
  properties: { accountId: { type: "string", minLength: 2, maxLength: 64 } },
};

function asResearchRequest(request: object): ResearchRequest {
  const value = request as { accountId?: unknown };
  if (typeof value.accountId !== "string") throw new Error("request.accountId is required");
  return { accountId: value.accountId };
}

export function createDefaultServiceRegistry(chain: NearChain): ServiceRegistry {
  const registry = new ServiceRegistry();
  registry.register<ResearchRequest, ResearchResult>({
    descriptor: {
      id: "research-api",
      version: "1.0.0",
      title: "Finalized NEAR account research",
      requestSchema: accountRequestSchema,
      metering: "per-call",
      source: "finalized-near-rpc",
    },
    execute: (request) => researchNearAccount(chain, asResearchRequest(request)),
  }, ["refund-api"]);

  registry.register<ResearchRequest, Record<string, unknown>>({
    descriptor: {
      id: "account-risk",
      version: "1.0.0",
      title: "Finalized NEAR account risk signals",
      requestSchema: accountRequestSchema,
      metering: "per-call",
      source: "finalized-near-rpc",
    },
    execute: async (request) => {
      const research = await researchNearAccount(chain, asResearchRequest(request));
      const total = BigInt(research.amountYocto) + BigInt(research.lockedYocto);
      return {
        kind: "near-account-risk",
        accountId: research.accountId,
        network: research.network,
        blockHeight: research.blockHeight,
        classification: research.classification,
        hasDeployedCode: research.classification === "contract",
        hasLockedBalance: BigInt(research.lockedYocto) > 0n,
        storageUsageBytes: research.storageUsageBytes,
        balanceComposition: total === 0n ? "empty" : BigInt(research.lockedYocto) * 2n > total ? "mostly-locked" : "mostly-liquid",
        notice: "Deterministic account signals are not a credit score or investment recommendation.",
        source: research.source,
      };
    },
  });
  return registry;
}
