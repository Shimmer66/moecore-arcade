export const FIXED_DT = 1 / 60;
export const GRAVITY = 24;
export const JUMP_SPEED = 9;
export const PLAYER_WIDTH = 0.6;
export const STANDING_HEIGHT = 1.8;
export const CROUCHING_HEIGHT = 0.8;

export const INITIAL_SPEED = 6;
export const MAX_SPEED = 12;
export const SPEED_PER_METER = 0.015;
export const SCORE_PER_METER = 10;
export const FINISH_DISTANCE = 1_200;

export const OBSTACLE_WIDTH = 0.8;
export const GROUND_HEIGHT = 0.6;
export const AIR_BOTTOM = 1;
export const AIR_HEIGHT = 4;
export const FIRST_OBSTACLE_DISTANCE = 18;
export const LOOKAHEAD_DISTANCE = 60;
export const MIN_RECOVERY_SECONDS = 1;

// Edge-to-edge gap: even at the speed cap, the entire player gets a recovery second.
export const MIN_OBSTACLE_GAP = MAX_SPEED * MIN_RECOVERY_SECONDS + PLAYER_WIDTH;
