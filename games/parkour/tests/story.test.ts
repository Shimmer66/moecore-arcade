import { describe, expect, it } from 'vitest';
import { endingFor, opening, quips } from '../src/config/story';
import { departmentAt, levels, SHIFT_DISTANCE } from '../src/config/shift';
import { officeAssetIds, poseId } from '../src/config/art';
import { WHALE_RUNNER_MANIFEST as manifest } from '@moecore/assets/whale-runner';

describe('playable AI character story', () => {
  it('uses one opening exchange and acknowledges delivery rather than just distance', () => {
    expect(opening.request).toContain('小游戏');
    expect(opening.action).toBe('开跑');
    expect(endingFor(true, false).title).toBe('答案还在前面');
    expect(endingFor(false, true).title).toBe('答案还在前面');
    expect(endingFor(false, false, 0, 0, 0, 'air-collision').body).toContain('滑铲');
    expect(endingFor(true, true, 2, 2, 2).body).toContain('拒绝幻觉');
    expect(endingFor(true, true).title).toBe('答案送达，白饭没白吃');
    expect(endingFor(true, true).body).not.toContain('本局收获');
    expect(endingFor(true, true, 2, 0, 0).body).toContain('干饭认证');
    expect(endingFor(true, true, 2, 0, 0).body).not.toContain('退件高手');
    expect(departmentAt(0).name).toBe('白饭补给海湾');
    expect(departmentAt(95).name).toBe('白饭补给海湾');
    expect(departmentAt(280).name).toBe('回音礁入口');
    expect(departmentAt(380).name).toBe('请求浅滩');
    expect(departmentAt(SHIFT_DISTANCE).name).toBe('答案灯塔');
    expect(levels).toHaveLength(4);
    expect(departmentAt(0, 1).name).toBe('回音礁');
    expect(departmentAt(0, 2).name).toBe('请求漩涡');
    expect(departmentAt(0, 3).name).toBe('无限航线');
  });
  it('references available art and actual event reactions', () => {
    const ids = new Set(manifest.assets.map((asset) => asset.id));
    for (const id of officeAssetIds) expect(ids.has(id)).toBe(true);
    for (const scene of [opening, ...Object.values(quips)])
      expect(ids.has(scene.portrait)).toBe(true);
    expect(quips.parry.line).toContain('原路退回');
    expect(quips.verified.line).toContain('查无此饭');
    expect(poseId('run', 0, 0, false)).not.toBe(poseId('run', 6, 0, false));
    expect(poseId('run', 0, 0, true)).toBe(poseId('run', 6, 0, true));
  });
});
