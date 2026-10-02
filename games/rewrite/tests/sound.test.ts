import { describe, expect, it } from 'vitest';
import { effectTones, midiFrequency, musicBpm, musicTones } from '../src/sound';
import { weaponOrder } from '../src/rules';

describe('procedural soundtrack and weapon feedback', () => {
  it('gives every stage a distinct deterministic theme with bounded voices', () => {
    const signatures = new Set(
      Array.from({ length: 8 }, (_, stage) =>
        Array.from({ length: 8 }, (_, beat) =>
          musicTones(stage, beat, false)
            .map((tone) => Math.round(tone.start))
            .join(':'),
        ).join('|'),
      ),
    );
    expect(signatures.size).toBe(8);
    for (let stage = 0; stage < 8; stage++)
      for (let beat = 0; beat < 32; beat++) {
        const tones = musicTones(stage, beat, beat > 15, stage % 5);
        expect(tones.length).toBeGreaterThan(0);
        expect(tones.length).toBeLessThanOrEqual(3);
        expect(tones.every((tone) => tone.start > 10 && tone.start < 5000)).toBe(true);
      }
  });
  it('raises tempo and adds weight during boss encounters', () => {
    for (let stage = 0; stage < 8; stage++) {
      expect(musicBpm(stage, true)).toBeGreaterThan(musicBpm(stage, false));
      expect(musicTones(stage, 0, true).length).toBeGreaterThan(musicTones(stage, 0, false).length);
    }
  });
  it('assigns every weapon a distinct valid sound patch', () => {
    const signatures = weaponOrder.map((weapon) =>
      effectTones('shoot', weapon)
        .map((tone) => `${tone.type}:${tone.start}:${tone.end}:${tone.duration}`)
        .join('|'),
    );
    expect(new Set(signatures).size).toBe(weaponOrder.length);
    for (const weapon of weaponOrder)
      expect(
        effectTones('shoot', weapon).every(
          (tone) =>
            tone.start > 0 &&
            tone.end > 0 &&
            tone.duration > 0 &&
            tone.duration <= 0.2 &&
            tone.volume > 0,
        ),
      ).toBe(true);
  });
  it('keeps musical pitch conversion stable at concert A', () => {
    expect(midiFrequency(69)).toBe(440);
    expect(midiFrequency(81)).toBe(880);
  });
});
