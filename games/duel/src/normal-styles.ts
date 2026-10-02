import type { FighterId } from './types';

/** Close punches and fast kicks define each fighter's pressure and spacing. */
export const NORMAL_STYLE: Record<
  FighterId,
  {
    closeName: string;
    kickName: string;
    tip: string;
    close: [number, number, number, number];
    kick: [number, number, number, number];
  }
> = {
  deepseek: {
    closeName: '饭勺寸劲',
    kickName: '护饭小踢',
    tip: '轻脚护住饭碗，贴脸重拳接挑空；远重脚把蹭饭的踹开。',
    close: [8, 75, 74, 31],
    kick: [6, 35, 94, 22],
  },
  gpt: {
    closeName: '首先肘你',
    kickName: '其次踢你',
    tip: '近重拳启动最快，接正摇连拳；轻脚先试探，确认打中再继续。',
    close: [7, 70, 70, 28],
    kick: [5, 32, 90, 20],
  },
  doubao: {
    closeName: '包你一肘',
    kickName: '包退小脚',
    tip: '轻脚伸得远，蹲轻脚留人，再用气泡和跳攻换着压。',
    close: [9, 65, 78, 30],
    kick: [7, 34, 106, 24],
  },
  client: {
    closeName: '需求变更肘',
    kickName: '顺便改一脚',
    tip: '近重拳最疼、起手较慢；轻脚留住人，接大拳或退回重做。',
    close: [10, 100, 82, 38],
    kick: [8, 45, 88, 27],
  },
  prompt_sage: {
    closeName: '键盘短打',
    kickName: '提示词补一脚',
    tip: '轻脚范围最长但收得慢；近重拳接飞符，逼对手交防御。',
    close: [8, 60, 86, 30],
    kick: [7, 30, 114, 26],
  },
  unplug_uncle: {
    closeName: '查表肘',
    kickName: '网线绊脚',
    tip: '轻脚够远，近重拳接网线拉人；断网期间照样能用四键拳脚。',
    close: [9, 85, 78, 34],
    kick: [7, 40, 102, 24],
  },
};
