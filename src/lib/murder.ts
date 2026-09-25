// ============================================================
// 剧本杀：预设剧本（单人模式，AI 扮演其他角色）。
// 剧本是硬编码的静态数据，后续可继续添加更多剧本。
// ============================================================

export interface MysteryCharacter {
  name: string;
  identity: string;     // 公开身份
  publicInfo: string;   // 所有人可见的信息
  secret: string;       // 只有该角色本人知道的秘密
  task: string;         // 隐藏任务（该角色要隐瞒/达成的）
}

export interface MysteryClue {
  id: string;
  name: string;
  desc: string;
}

export interface MysteryScript {
  id: string;
  title: string;
  background: string;
  characters: MysteryCharacter[];
  clues: MysteryClue[];
  culprit: string;      // 真凶（角色名）
  truth: string;        // 真相
}

export const MYSTERY_SCRIPTS: MysteryScript[] = [
  {
    id: "manor",
    title: "风雪庄园凶案",
    background:
      "一个风雪交加的夜晚，庄园主人林老爷被发现死在书房，门窗反锁。当晚庄园里只有四个人，每个人都心怀秘密。真凶就藏在其中。",
    characters: [
      {
        name: "管家老陈",
        identity: "管家",
        publicInfo: "在庄园服务了三十年，深得林老爷信任。",
        secret: "你早年挪用庄园账目被发现，林老爷以此长期要挟你。",
        task: "隐瞒你挪用账目的证据，别让人查到。",
      },
      {
        name: "苏婉",
        identity: "女主人（死者第二任妻子）",
        publicInfo: "年轻貌美，与林老爷结婚不到两年。",
        secret: "你与园丁阿强有私情，而且林老爷最近改了遗嘱，你的份额被大幅削减。",
        task: "隐瞒与阿强的私情，保住自己的遗产份额。",
      },
      {
        name: "林风",
        identity: "少爷（死者长子）",
        publicInfo: "林老爷与原配之子，父子关系一直不睦。",
        secret: "你欠下巨额赌债，急需继承遗产还债。",
        task: "隐瞒赌债，别让人知道你比谁都缺钱。",
      },
      {
        name: "阿强",
        identity: "园丁",
        publicInfo: "新来的园丁，沉默寡言，很少与人来往。",
        secret: "你其实是林老爷的私生子，曾上门认亲却被无情拒绝。",
        task: "隐瞒你的真实身份，查清当年被拒的真相。",
      },
    ],
    clues: [
      { id: "c1", name: "湿脚印", desc: "书房地毯上有一串半干的泥脚印，说明有人进过书房。" },
      { id: "c2", name: "撕掉一半的照片", desc: "死者手里攥着半张照片，另一半被撕走了。" },
      { id: "c3", name: "新遗嘱", desc: "书桌上有一份新立的遗嘱，遗产给了一个令人意外的人。" },
      { id: "c4", name: "带血的花瓶", desc: "角落的花瓶碎了，碎片上沾着血迹。" },
      { id: "c5", name: "一封威胁信", desc: "抽屉里有一封信，写着威胁与勒索的内容。" },
      { id: "c6", name: "门外的脚印", desc: "雪地上只有通往正门的一行脚印，没有外人来过。" },
    ],
    culprit: "管家老陈",
    truth:
      "真相：林老爷发现管家老陈挪用账目后，准备在遗嘱里将一切交给别人，并扬言要揭发。老陈在争吵中失手用花瓶砸死了林老爷，随后撕毁照片、锁上门，伪装成意外。",
  },
];
