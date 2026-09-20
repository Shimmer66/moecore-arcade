export const CHARACTERS = [
  { id: 'deepseek', displayName: 'DeepSeek 娘', artworkStatus: 'pending-review' },
  { id: 'glm', displayName: 'GLM 娘', artworkStatus: 'pending-review' },
  { id: 'gpt', displayName: 'GPT 娘', artworkStatus: 'pending-review' },
  { id: 'claude', displayName: 'Claude 娘', artworkStatus: 'pending-review' },
  { id: 'gemini', displayName: 'Gemini 娘', artworkStatus: 'pending-review' },
  { id: 'kimi', displayName: 'Kimi 娘', artworkStatus: 'pending-review' },
] as const;

export type Character = (typeof CHARACTERS)[number];
export type CharacterId = Character['id'];
