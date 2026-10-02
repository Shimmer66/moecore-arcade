// Fictional game pacing, not a description of any model's real inference settings.
export const thinkingModes = {
  quick: { label: 'Low', hint: '快答：跑得快，慢镜短', speed: 1.08, slowTicks: 18 },
  normal: { label: 'High', hint: '均衡：适合初次开跑', speed: 1, slowTicks: 36 },
  deep: { label: 'Max', hint: '深思：跑得稳，慢镜长', speed: 0.94, slowTicks: 60 },
} as const;

export type ThinkingMode = keyof typeof thinkingModes;
