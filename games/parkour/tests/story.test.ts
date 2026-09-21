import { describe, expect, it } from 'vitest';
import { endingFor, opening, quips } from '../src/config/story';
import { departmentAt, SHIFT_DISTANCE } from '../src/config/shift';
import { officeAssetIds, poseId } from '../src/config/art';
import { WHALE_RUNNER_MANIFEST as manifest } from '@moecore/assets/whale-runner';

describe('playable AI character story', () => {
  it('uses one opening exchange and acknowledges delivery rather than just distance', () => {
    expect(opening.request).toContain('小游戏');
    expect(opening.action).toBe('开跑');
    expect(endingFor(true, false).title).toContain('人先扁了');
    expect(endingFor(false, true).title).toContain('人先扁了');
    expect(endingFor(true, true, 2, 2, 2).body).toContain('拒绝幻觉');
    expect(endingFor(true, true).body).toContain('干饭待修炼');
    expect(departmentAt(0).name).toBe('食堂分部');
    expect(departmentAt(95).name).toBe('补充说明科');
    expect(departmentAt(280).name).toBe('服务器排队区');
    expect(departmentAt(SHIFT_DISTANCE).name).toBe('交付出口');
  });
  it('references available art and actual event reactions', () => {
    const ids = new Set(manifest.assets.map((asset) => asset.id));
    for (const id of officeAssetIds) expect(ids.has(id)).toBe(true);
    for (const scene of [opening, ...Object.values(quips)])
      expect(ids.has(scene.portrait)).toBe(true);
    expect(quips.parry.line).toContain('弹回');
    expect(quips.verified.line).toContain('查无此饭');
    expect(poseId('run', 0, 0, false)).not.toBe(poseId('run', 6, 0, false));
    expect(poseId('run', 0, 0, true)).toBe(poseId('run', 6, 0, true));
  });
});
