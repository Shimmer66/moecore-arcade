export const prologue = {
  title: '把星光带回灯塔',
  body: '今晚，星潮灯塔突然熄灭。最后一艘归航船还在海上，四位伙伴决定把散落的星光带回去。',
};

export const openingLines = {
  deepseek: '我听见潮水里的求救声了。跟紧我，我们一定赶得上。',
  glm: '星图还在，航线就不会断。我来记住回家的坐标。',
  gpt: '一颗星也许很小，但我们可以把它们重新连起来。',
  claude: '那艘船上还有人在等这盏灯。我们出发吧。',
} as const;

export const chapterStories = [
  {
    title: '第一章 · 灯塔的秘密',
    speaker: 'glm',
    name: 'GLM',
    body: '遗迹里的旧星图亮了起来。灯塔不是坏了：每当有人在海上迷路，它就借出一束光，直到自己再也发不出光。',
    line: '这些星光记得每一位旅人。我们要带回去的，是他们回家的路。',
    reward: '中继站补给 · 恢复一颗心',
  },
  {
    title: '第二章 · 一起回家',
    speaker: 'claude',
    name: 'Claude',
    body: '穿过回廊，远处的船只亮起一排微弱的灯。旅人们也发现了你，正把最后的能量汇成一股顺流。',
    line: '灯塔不是在等一个英雄。它在等我们一起把光带回来。',
    reward: '归航者的回应 · 冲刺能量充满',
  },
] as const;

export function endingFor(completed: boolean, coins: number) {
  if (!completed)
    return {
      title: '潮水里的约定',
      body: '这一程没能走到灯塔。伙伴们在岸边接住了你，也护住了那枚星核。海上的灯还没有熄灭，下一次，一起把它送到。',
    };
  if (coins >= 60)
    return {
      title: '星潮长明',
      body: '你带回的星光填满了灯塔，照亮了整片海。最后一艘船平安归港，旅人们将一盏盏小灯留在岸边。从今晚起，再也不让灯塔独自发光。',
    };
  if (coins >= 30)
    return {
      title: '归航之光',
      body: '星核在塔顶亮起，散落的星光重新连成航线。最后一艘船穿过夜色，朝你们驶来。还有一些星光留在路上，明天的旅程仍在等待。',
    };
  return {
    title: '第一盏灯',
    body: '星核点亮了灯塔顶端的一小束光。旅人们看见了方向，四位伙伴约好继续寻找散落的星光。这一次，回家的路已经有了起点。',
  };
}
