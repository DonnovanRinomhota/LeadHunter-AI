import type { QualificationOutput } from "@/contracts/qualification";
import type { PromptLead, PromptProfile, PromptService } from "./prompt";

export type ModelRequest = {
  system: string;
  user: string;
  schema: unknown;
  serviceIds: string[];
};

export type ModelReply = {
  stopReason: string | null;
  text: string;
  inputTokens: number;
  outputTokens: number;
};

export type ModelClient = {
  provider: string;
  modelName: string;
  complete(request: ModelRequest): Promise<ModelReply>;
};

export type LoadedLead = PromptLead & { id: string; workspace_id: string; status: string };

export type NewAnalysis = {
  lead: LoadedLead;
  output: QualificationOutput;
  recency: number;
  provider: string;
  modelName: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
};

export type QualificationStore = {
  loadLead(leadId: string): Promise<LoadedLead | null>;
  loadServices(workspaceId: string): Promise<PromptService[]>;
  loadProfile(workspaceId: string): Promise<PromptProfile>;
  saveAnalysis(analysis: NewAnalysis): Promise<void>;
  transition(leadId: string, to: "qualified" | "research" | "disqualified", reason: string | null): Promise<void>;
  recordFailure(leadId: string, message: string): Promise<void>;
  claim(limit: number): Promise<{ lead_id: string; workspace_id: string }[]>;
  countAnalysesSince(since: Date): Promise<number>;
};

export type QualifyResult =
  | { leadId: string; outcome: "qualified" | "research" | "disqualified"; score: number; action: string }
  | { leadId: string; outcome: "failed"; error: string };
