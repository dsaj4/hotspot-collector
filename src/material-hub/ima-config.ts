import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { imaOpenapiApiKey, imaOpenapiClientId, materialHubImaKnowledgeBaseId } from "../config.js";
import { materialHubRoot } from "./utils.js";

export type MaterialHubImaConfig = {
  knowledgeBaseId: string;
  clientId: string;
  apiKey: string;
  sources: {
    knowledgeBaseId: "env" | "local-file" | "missing";
    clientId: "env" | "ima-config-file" | "missing";
    apiKey: "env" | "ima-config-file" | "missing";
  };
};

type LocalImaConfig = {
  knowledgeBaseId?: unknown;
};

function readTrimmedFile(file: string): string {
  if (!existsSync(file)) return "";
  return readFileSync(file, "utf8").trim();
}

function readLocalKnowledgeBaseId(): string {
  const localPath = path.join(materialHubRoot, "config", "ima.local.json");
  if (!existsSync(localPath)) return "";
  const parsed = JSON.parse(readFileSync(localPath, "utf8")) as LocalImaConfig;
  return typeof parsed.knowledgeBaseId === "string" ? parsed.knowledgeBaseId.trim() : "";
}

export function loadMaterialHubImaConfig(): MaterialHubImaConfig {
  const imaConfigDir = path.join(os.homedir(), ".config", "ima");
  const localKnowledgeBaseId = readLocalKnowledgeBaseId();
  const fileClientId = readTrimmedFile(path.join(imaConfigDir, "client_id"));
  const fileApiKey = readTrimmedFile(path.join(imaConfigDir, "api_key"));
  const knowledgeBaseId = materialHubImaKnowledgeBaseId || localKnowledgeBaseId;
  const clientId = imaOpenapiClientId || fileClientId;
  const apiKey = imaOpenapiApiKey || fileApiKey;

  return {
    knowledgeBaseId,
    clientId,
    apiKey,
    sources: {
      knowledgeBaseId: materialHubImaKnowledgeBaseId ? "env" : localKnowledgeBaseId ? "local-file" : "missing",
      clientId: imaOpenapiClientId ? "env" : fileClientId ? "ima-config-file" : "missing",
      apiKey: imaOpenapiApiKey ? "env" : fileApiKey ? "ima-config-file" : "missing"
    }
  };
}
