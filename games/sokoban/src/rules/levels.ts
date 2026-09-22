import type { Level } from './types';

/** Authored campaign: the first room teaches the rule, later rooms require planning. */
export const levels: readonly Level[] = [
  {
    id: 1,
    title: '初次搬运',
    difficulty: '简单',
    subtitle: '把小木箱送到鲸鱼圆环里',
    hint: '走到箱子左边，轻轻向右推。',
    map: ['#######', '#     #', '#@ $ .#', '#     #', '#     #', '#######'],
    solution: 'EEE',
  },
  {
    id: 2,
    title: '借位搬运',
    difficulty: '适中',
    subtitle: '两只箱子，要给彼此留路',
    hint: '先为另一只箱子留出向上推的站位，再填下方圆环。',
    map: [
      '########',
      '#      #',
      '#.#$#  #',
      '# $@   #',
      '#. #   #',
      '# #    #',
      '#      #',
      '########',
    ],
    solution: 'WEEENNWWSNWWSSSNNNEEEESSWWWSWNEEESSSWWWN',
  },
  {
    id: 3,
    title: '三箱争道',
    difficulty: '困难',
    subtitle: '三箱争道，先决定谁来让路',
    hint: '先把中间箱送入右侧缓冲区，最后再回填近处圆环。',
    map: [
      '########',
      '#@     #',
      '#.$##  #',
      '# $    #',
      '#.#.#  #',
      '#$     #',
      '#      #',
      '########',
    ],
    solution: 'SSEEEWWWNNESNEEESSSESWWSWNSWWNNNEEEWWNNEEESSSESWWWWSWN',
  },
  {
    id: 4,
    title: '先退再进',
    difficulty: '困难',
    subtitle: '已到位的箱子，也要先让路',
    hint: '中央圆环上的箱子要先移开，疏通转身位置。',
    map: [
      '########',
      '#   ####',
      '# @$   #',
      '# ##*  #',
      '#.$  # #',
      '# #$  .#',
      '#.  ####',
      '########',
    ],
    solution: 'EESSNEENWWWNWWSSSEEWWSSEENENNSSWSWWNNNNNEESWEESEENWWWNWWSSSEESEEWNWWWSNNNNEESWNWSS',
  },
  {
    id: 5,
    title: '回环仓库',
    difficulty: '困难',
    subtitle: '高难 · 四箱接力，给下一箱留出路',
    hint: '开局先向左推动上方箱子，给右侧入口腾出空间。',
    map: [
      '#########',
      '#.   ####',
      '#  #  $@#',
      '#    $#$#',
      '# ###   #',
      '#  . $# #',
      '# #    .#',
      '#  .#####',
      '#########',
    ],
    solution:
      'WWEESSWWNWWWNNEESESSEENNWWSWWWNNEESNWWSWSSSEESSWWNNEEESEEENNWWSNEESSWWWNWWWSSEENSWWNNNNNESEENESSSNEESSWWWNWSNEENNNEESSSNWWNWWWWSSE',
  },
];

export function validateLevel(level: Level): void {
  if (level.map.length === 0 || level.map[0]?.length === 0)
    throw new TypeError('Level map cannot be empty');
  const width = level.map[0]?.length ?? 0;
  let players = 0;
  let boxes = 0;
  let goals = 0;
  for (const row of level.map) {
    if (row.length !== width) throw new TypeError('Level rows must have equal width');
    for (const cell of row) {
      if (!'# .$@+*'.includes(cell)) throw new TypeError(`Unknown map character: ${cell}`);
      if (cell === '@' || cell === '+') players += 1;
      if (cell === '$' || cell === '*') boxes += 1;
      if (cell === '.' || cell === '+' || cell === '*') goals += 1;
    }
  }
  if (players !== 1) throw new TypeError('Level must contain exactly one player');
  if (boxes === 0 || boxes !== goals) throw new TypeError('Level boxes and goals must match');
}

for (const level of levels) validateLevel(level);
