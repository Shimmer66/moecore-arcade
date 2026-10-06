export type StardustActorId =
  | 'jotaro'
  | 'kakyoin'
  | 'avdol'
  | 'polnareff'
  | 'gray-fly'
  | 'devo'
  | 'rubber-soul'
  | 'holhorse'
  | 'j-geil'
  | 'nena'
  | 'alessi'
  | 'mariah'
  | 'ndoul'
  | 'darby-elder'
  | 'darby-younger'
  | 'pet-shop'
  | 'ice'
  | 'dio';

export type StardustAudioEvent =
  | 'select'
  | 'confirm'
  | 'summon'
  | 'panel'
  | 'fight'
  | 'step'
  | 'idle'
  | 'light-swing'
  | 'light-hit'
  | 'heavy-swing'
  | 'heavy-hit'
  | 'blade-swing'
  | 'blade-ultimate'
  | 'blade-finish'
  | 'barrage'
  | 'special'
  | 'block'
  | 'hurt'
  | 'down'
  | 'ko'
  | 'revive'
  | 'next-fighter'
  | 'team-clear'
  | 'time-stop'
  | 'time-resume';

export interface ToneLayer {
  type: OscillatorType | 'noise';
  from: number;
  to: number;
  duration: number;
  gain: number;
  delay?: number;
}

export interface StardustAudioCue {
  category: 'sfx' | 'ambience';
  layers: readonly ToneLayer[];
  recording?: {
    src: string;
    gain: number;
    maxVoices: number;
    restart?: boolean;
  };
}

export interface StardustAudioRequest {
  event: StardustAudioEvent;
  actor?: StardustActorId;
  pan?: number;
}
