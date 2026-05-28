# LCU API 数据维度总览

> 每个对局可统计的玩家数据维度，适用于"伤害最高/承伤最多/治疗最多"等选手排名需求。

---

## 1. 伤害输出（12 维度）

| 字段 | 含义 | 排名场景 |
|------|------|---------|
| `damage.total_to_champs` | 对英雄总伤害 | **伤害大王** |
| `damage.total_dealt` | 总伤害（含小兵/野怪/塔） | 综合输出 |
| `damage.physical_to_champs` | 对英雄物理伤害 | AD 输出 |
| `damage.magic_to_champs` | 对英雄魔法伤害 | AP 输出 |
| `damage.true_to_champs` | 对英雄真实伤害 | 真伤输出 |
| `damage.physical_dealt` / `magic_dealt` / `true_dealt` | 物理/魔法/真实总伤害 | 伤害构成分析 |
| `damage.largest_critical_strike` | 最大暴击伤害 | 暴击峰值 |
| `damage.total_taken` / `physical_taken` / `magic_taken` / `true_taken` | 承担各类型伤害 | **沙包奖** |

## 2. 治疗 & 生存（4 维度）

| 字段 | 含义 | 排名场景 |
|------|------|---------|
| `survival.total_heal` | 总治疗量 | **奶量最高** |
| `survival.total_units_healed` | 治疗单位数 | 辅助覆盖面 |
| `survival.damage_self_mitigated` | 自我减伤量 | **最硬选手**（含护盾/抗性减伤） |
| `survival.longest_time_living` | 最长存活时间（秒） | **不死战神** |

## 3. KDA & 击杀（12 维度）

| 字段 | 含义 | 排名场景 |
|------|------|---------|
| `kills` / `deaths` / `assists` | 击杀/死亡/助攻 | 基础 KDA |
| `kda` / `kda_ratio` | KDA 数值 / 字符串 | KDA 排名 |
| `largest_multi_kill` | 最大连杀数（1-5） | 收割能力 |
| `largest_killing_spree` | 最高连杀数 | 滚雪球能力 |
| `double_kills` ~ `penta_kills` | 双杀/三杀/四杀/五杀 次数 | 团战收割机 |
| `unreal_kills` | 未实现击杀（特定模式） | — |

## 4. 控制 & 功能性（2 维度）

| 字段 | 含义 | 排名场景 |
|------|------|---------|
| `cc.time_cc_others` | 对敌方控制时长（秒） | **老控子** |
| `cc.total_cc_dealt` | 总控制效果量 | 控制贡献 |

## 5. 视野（5 维度）

| 字段 | 含义 | 排名场景 |
|------|------|---------|
| `vision.score` | 视野得分 | **视野王** |
| `vision.wards_placed` | 插眼数 | 视野投入 |
| `vision.wards_killed` | 排眼数 | 视野压制 |
| `vision.sight_wards_bought` | 购买假眼数 | — |
| `vision.vision_wards_bought` | 购买真眼数 | — |

## 6. 经济 & 补刀（7 维度）

| 字段 | 含义 | 排名场景 |
|------|------|---------|
| `economy.gold_earned` | 获得金币 | **打钱王** |
| `economy.gold_spent` | 花费金币 | 经济转化率 |
| `cs.total` / `minions` | 总补刀/小兵补刀 | **补刀机器** |
| `cs.neutral_total` | 野怪补刀 | 野区资源 |
| `cs.neutral_enemy_jungle` / `neutral_team_jungle` | 敌方/己方野怪 | 反野能力 |

## 7. 推塔 & 目标伤害（4 维度）

| 字段 | 含义 | 排名场景 |
|------|------|---------|
| `objectives.turret_kills` | 推塔数 | **拆迁队长** |
| `objectives.inhibitor_kills` | 推水晶数 | 推进贡献 |
| `objectives.damage_to_turrets` | 对塔伤害 | 推塔伤害 |
| `objectives.damage_to_objectives` | 对史诗目标伤害 | 打龙/打先锋贡献 |

## 8. 先锋事件（6 维度，bool）

| 字段 | 含义 |
|------|------|
| `firsts.first_blood_kill` / `first_blood_assist` | 一血击杀/助攻 |
| `firsts.first_tower_kill` / `first_tower_assist` | 一塔击杀/助攻 |
| `firsts.first_inhibitor_kill` / `first_inhibitor_assist` | 首水晶击杀/助攻 |

## 9. 符文（18 维度）

| 字段 | 含义 |
|------|------|
| `runes.primary_style` / `sub_style` | 主系/副系符文页 ID |
| `runes.perks[0]~[5]` | 6 个符文 ID |
| `runes.perk_vars.perk0~5` | 每个符文 3 个变量值（如叠层、触发次数等） |

## 10. 装备（8 维度）

| 字段 | 含义 |
|------|------|
| `items[0]~[6]` | 7 格装备 ID（含守卫位） |
| `role_bound_item` | 角色限定装备 ID |

## 11. 召唤师技能 & 位置（5 维度）

| 字段 | 含义 |
|------|------|
| `summoner_spells.spell1` / `spell2` | 召唤师技能 ID |
| `position.lane` / `team_position` / `individual_position` | 位置（仅排位模式有值） |

## 12. 评分系统（14 维度）

| 字段 | 含义 | 排名场景 |
|------|------|---------|
| `scores.combat` | 战斗评分 | **MVP 候选** |
| `scores.objective` | 目标评分 | 运营贡献 |
| `scores.total` / `rank` | 总评分 / 全队排名 | 综合实力 |
| `scores.details[0]~[9]` | 10 项分维度评分 | 雷达图数据源 |

## 13. 投降 & 行为（8 维度，bool）

| 字段 | 含义 |
|------|------|
| `surrender.game_ended_in_surrender` | 本局是否投降结束 |
| `surrender.game_ended_in_early_surrender` | 是否早期投降（15min 内） |
| `surrender.team_early_surrendered` | 本队是否发起早期投降 |
| `surrender.caused_early_surrender` | 是否触发早期投降 |
| `surrender.caused_game_end_from_ignb_surrender` | 是否引发 IGNB 投降 |
| `surrender.early_surrender_accomplice` | 是否早期投降共犯 |
| `surrender.game_ended_in_ignb_surrender` | 是否 IGNB 投降结束 |
| `was_severe_transgressor` | 是否严重违规者 |

## 14. 斗魂竞技场（8 维度）

| 字段 | 含义 |
|------|------|
| `arena.subteam_placement` | 小队排名 |
| `arena.player_subteam_id` | 子队伍 ID |
| `arena.player_augments[0]~[5]` | 6 个强化天赋 ID |

## 15. 队伍维度（每对局）

| 字段 | 含义 | 排名场景 |
|------|------|---------|
| `baron_kills` / `dragon_kills` | 纳什男爵/巨龙击杀 | 资源控制 |
| `rift_herald_kills` / `horde_kills` | 先锋/巢虫击杀 | 前期运营 |
| `tower_kills` / `inhibitor_kills` | 推塔/水晶总数 | 推进力 |
| `first_blood` / `first_tower` / `first_inhibitor` / `first_baron` / `first_dragon` | 各大先锋事件归属 | 节奏掌控 |
| `bans` | 禁用英雄列表 | BP 分析 |

## 16. 英雄熟练度（按对局英雄）

| 字段 | 含义 |
|------|------|
| `level` | 英雄专精等级（1-7） |
| `points` | 英雄成就点数 |
| `highest_grade` | 历史最高评分（S+/S/A+ 等） |

## 17. 排位数据（按队列）

| 字段 | 含义 |
|------|------|
| `tier` / `division` | 段位/级别 |
| `league_points` | 胜点 LP |
| `wins` / `losses` / `win_rate` | 胜场/负场/胜率 |

---

## 可用于"XX之最"排名的核心维度汇总

| 称号 | 对应字段 |
|------|---------|
| **伤害大王** | `damage.total_to_champs` |
| **沙包奖** | `damage.total_taken` |
| **奶量最高** | `survival.total_heal` |
| **最硬选手** | `survival.damage_self_mitigated` |
| **不死战神** | `survival.longest_time_living` |
| **老控子** | `cc.time_cc_others` |
| **MVP** | `scores.total` 或 `scores.rank` |
| **打钱王** | `economy.gold_earned` |
| **补刀机器** | `cs.total` |
| **拆迁队长** | `objectives.turret_kills` |
| **视野王** | `vision.score` |

共 **~120 个玩家维度 + 15 个队伍维度 + 排位/熟练度**，全部自 LCU 本地 API 提取。
