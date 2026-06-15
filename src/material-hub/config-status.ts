import { deepseekApiKey, deepseekBaseUrl, deepseekModel } from "../config.js";
import { loadMaterialHubImaConfig } from "./ima-config.js";

export type MaterialHubConfigStatus = {
  generatedAt: string;
  deepseek: {
    configured: boolean;
    apiKeyPresent: boolean;
    baseUrl: string;
    model: string;
  };
  ima: {
    configured: boolean;
    knowledgeBaseIdPresent: boolean;
    clientIdPresent: boolean;
    apiKeyPresent: boolean;
    sources: {
      knowledgeBaseId: string;
      clientId: string;
      apiKey: string;
    };
  };
};

export function materialHubConfigStatus(): MaterialHubConfigStatus {
  const ima = loadMaterialHubImaConfig();
  return {
    generatedAt: new Date().toISOString(),
    deepseek: {
      configured: Boolean(deepseekApiKey),
      apiKeyPresent: Boolean(deepseekApiKey),
      baseUrl: deepseekBaseUrl,
      model: deepseekModel
    },
    ima: {
      configured: Boolean(ima.knowledgeBaseId && ima.clientId && ima.apiKey),
      knowledgeBaseIdPresent: Boolean(ima.knowledgeBaseId),
      clientIdPresent: Boolean(ima.clientId),
      apiKeyPresent: Boolean(ima.apiKey),
      sources: ima.sources
    }
  };
}
