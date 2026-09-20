import { FIXED_DT } from '../config/constants';

export function assertFixedStep(dt: number): void {
  if (dt !== FIXED_DT) {
    throw new RangeError('dt must equal FIXED_DT (1/60 second).');
  }
}

export function assertDistance(distance: number): void {
  if (!Number.isFinite(distance) || distance < 0) {
    throw new RangeError('Distance must be finite and non-negative.');
  }
}
