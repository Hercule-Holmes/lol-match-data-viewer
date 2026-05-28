"""
单局详细数据查看工具
====================
按对局 ID 拉取并逐玩家展示全部维度数据。

用法:
    python fetch_game.py 10967588300          # 查看指定对局
    python fetch_game.py 10967588300 --json   # JSON 格式输出
"""

import json
import os
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lcu_client import LcuClient, extract_player_identity, extract_stats_full, find_lol_client


def format_number(n) -> str:
    """数字加上千分位"""
    if n is None:
        return "N/A"
    return f"{n:,}"


def print_player_detail(p: dict, identities: dict, team_side: str):
    """终端打印单个玩家的全维度数据"""
    stats = p.get("stats", {})
    pid = p.get("participantId")
    player_info = identities.get(pid, {})
    tid = p.get("teamId")

    raw_name = player_info.get("summonerName", "")
    game_name = player_info.get("gameName", "")
    tag_line = player_info.get("tagLine", "")
    name = raw_name or (f"{game_name}#{tag_line}" if game_name else "")

    team = "蓝" if tid == 100 else "红"
    w = "W" if stats.get("win") else "L"

    print(f"\n  {'─' * 66}")
    print(f"  [{team}] {name}  英雄ID:{p.get('championId')}  Lv{stats.get('champLevel')}  {w}")
    print(f"  {'─' * 66}")
    print(f"  KDA: {stats.get('kills')}/{stats.get('deaths')}/{stats.get('assists')}")

    dmg_c = stats.get("totalDamageDealtToChampions", 0)
    dmg_t = stats.get("totalDamageTaken", 0)
    dmg_a = stats.get("totalDamageDealt", 0)
    print(f"  [伤害] 对英雄: {format_number(dmg_c):>10}  总计: {format_number(dmg_a):>10}  承伤: {format_number(dmg_t):>10}")
    print(
        f"         物理输出: {format_number(stats.get('physicalDamageDealtToChampions', 0)):>10}"
        f"  魔法输出: {format_number(stats.get('magicDamageDealtToChampions', 0)):>10}"
        f"  真实输出: {format_number(stats.get('trueDamageDealtToChampions', 0)):>10}"
    )

    print(
        f"  [治疗] 总治疗: {format_number(stats.get('totalHeal', 0)):>10}"
        f"  治疗单位: {format_number(stats.get('totalUnitsHealed', 0)):>8}"
        f"  自减伤: {format_number(stats.get('damageSelfMitigated', 0)):>10}"
    )
    print(
        f"  [生存] 最长存活: {format_number(stats.get('longestTimeSpentLiving', 0)):>6}s"
        f"  最大暴击: {format_number(stats.get('largestCriticalStrike', 0)):>10}"
    )
    print(
        f"  [控制] CC时长: {format_number(stats.get('timeCCingOthers', 0)):>6}s"
        f"  总CC: {format_number(stats.get('totalTimeCrowdControlDealt', 0)):>6}"
    )
    print(
        f"  [经济] 金币: {format_number(stats.get('goldEarned', 0)):>10}"
        f"  花费: {format_number(stats.get('goldSpent', 0)):>10}"
    )
    print(
        f"  [补刀] 小兵: {format_number(stats.get('totalMinionsKilled', 0) or 0):>5}"
        f"  野怪: {format_number(stats.get('neutralMinionsKilled', 0) or 0):>5}"
        f"  敌方野: {format_number(stats.get('neutralMinionsKilledEnemyJungle', 0) or 0):>5}"
        f"  己方野: {format_number(stats.get('neutralMinionsKilledTeamJungle', 0) or 0):>5}"
    )
    print(
        f"  [目标] 推塔: {stats.get('turretKills', 0)}"
        f"  水晶: {stats.get('inhibitorKills', 0)}"
        f"  对塔伤害: {format_number(stats.get('damageDealtToTurrets', 0)):>10}"
        f"  对目标伤害: {format_number(stats.get('damageDealtToObjectives', 0)):>10}"
    )

    print(
        f"  [视野] 视野分: {stats.get('visionScore', 0)}"
        f"  插眼: {stats.get('wardsPlaced', 0)}"
        f"  排眼: {stats.get('wardsKilled', 0)}"
        f"  假眼: {stats.get('sightWardsBoughtInGame', 0)}"
        f"  真眼: {stats.get('visionWardsBoughtInGame', 0)}"
    )

    items = [stats.get(f"item{i}") for i in range(7)]
    print(f"  [装备] {[i for i in items if i]}")
    if stats.get("roleBoundItem"):
        print(f"         角色限定装备: {stats.get('roleBoundItem')}")

    perks = [stats.get(f"perk{i}") for i in range(6)]
    primary = stats.get("perkPrimaryStyle", 0)
    sub = stats.get("perkSubStyle", 0)
    if any(perks):
        print(f"  [符文] 主系:{primary} 副系:{sub}  perks:{perks}")

    print(f"  [技能] 召唤师技能: {p.get('spell1Id')}/{p.get('spell2Id')}")

    print(
        f"  [先锋] 一血杀:{stats.get('firstBloodKill')}"
        f" 一血助:{stats.get('firstBloodAssist')}"
        f" 一塔杀:{stats.get('firstTowerKill')}"
        f" 一塔助:{stats.get('firstTowerAssist')}"
        f" 一首水晶:{stats.get('firstInhibitorKill')}"
    )

    mult = {k: stats.get(k) for k in ['doubleKills', 'tripleKills', 'quadraKills', 'pentaKills', 'unrealKills']}
    mult_vals = {k: v for k, v in mult.items() if v}
    if mult_vals:
        print(f"  [多杀] {mult_vals}")
    print(
        f"  [连杀] spree:{stats.get('largestKillingSpree', 0)}"
        f"  sprees:{stats.get('killingSprees', 0)}"
        f"  largest:{stats.get('largestMultiKill', 0)}"
    )

    scores = {k: stats.get(k) for k in ['combatPlayerScore', 'objectivePlayerScore', 'totalPlayerScore', 'totalScoreRank']}
    score_details = [stats.get(f"playerScore{i}") for i in range(10)]
    print(
        f"  [评分] combat:{scores['combatPlayerScore']}"
        f"  obj:{scores['objectivePlayerScore']}"
        f"  total:{scores['totalPlayerScore']}"
        f"  rank:{scores['totalScoreRank']}"
    )
    if any(score_details):
        print(f"         明细: {score_details}")

    surr_keys = [
        'gameEndedInSurrender', 'gameEndedInEarlySurrender',
        'teamEarlySurrendered', 'causedEarlySurrender',
        'gameEndedInIGNBSurrender', 'causedGameEndFromIGNBSurrender',
        'earlySurrenderAccomplice'
    ]
    surr = {k: stats.get(k) for k in surr_keys if stats.get(k)}
    if surr:
        print(f"  [投降] {surr}")

    if stats.get("wasSevereTransgressor"):
        print(f"  [警告] 严重违规者")

    arena_keys = ['subteamPlacement', 'playerSubteamId'] + [f"playerAugment{i}" for i in range(1, 7)]
    arena = {k: stats.get(k) for k in arena_keys if stats.get(k)}
    if arena:
        print(f"  [竞技场] {arena}")


def main():
    if len(sys.argv) < 2:
        print("用法: python fetch_game.py <game_id> [--json]")
        print("示例: python fetch_game.py 10967588300")
        sys.exit(1)

    game_id = int(sys.argv[1])
    output_json = "--json" in sys.argv

    # 连接 LCU
    conn = find_lol_client()
    if not conn:
        print("[ERROR] 未找到运行中的 LOL 客户端")
        return

    client = LcuClient(conn)
    detail = client.get_game_detail(game_id)
    identities = {i["participantId"]: i.get("player", {}) for i in detail.get("participantIdentities", [])}

    if output_json:
        # JSON 输出
        result = {
            "game_id": detail.get("gameId"),
            "game_mode": detail.get("gameMode"),
            "queue_id": detail.get("queueId"),
            "duration_min": round(detail.get("gameDuration", 0) / 60, 1),
            "teams": [],
        }
        for team in detail.get("teams", []):
            players = []
            for p in detail.get("participants", []):
                if p.get("teamId") == team["teamId"]:
                    pid = p.get("participantId")
                    pinfo = identities.get(pid, {})
                    players.append({
                        **extract_player_identity(pinfo),
                        "champion_id": p.get("championId"),
                        "team_id": p.get("teamId"),
                        "spell1_id": p.get("spell1Id"),
                        "spell2_id": p.get("spell2Id"),
                        "stats": extract_stats_full(p),
                    })
            result["teams"].append({
                "team_id": team["teamId"],
                "win": team.get("win") == "Win",
                "bans": team.get("bans", []),
                "baron_kills": team.get("baronKills", 0),
                "dragon_kills": team.get("dragonKills", 0),
                "tower_kills": team.get("towerKills", 0),
                "players": players,
            })
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        # 终端友好输出
        print(f"\n{'='*70}")
        print(
            f"  Game #{game_id}  |  mode={detail.get('gameMode')}"
            f"  |  queue={detail.get('queueId')}"
            f"  |  {detail.get('gameDuration', 0) // 60}min"
        )
        print(f"{'='*70}")

        for team in detail.get("teams", []):
            side = "蓝方" if team["teamId"] == 100 else "红方"
            w = "WIN" if team.get("win") == "Win" else "LOSE"
            print(f"\n{'─'*70}")
            print(
                f"  {side} ({w})  "
                f"男爵:{team.get('baronKills', 0)}  "
                f"龙:{team.get('dragonKills', 0)}  "
                f"先锋:{team.get('riftHeraldKills', 0)}"
            )
            print(
                f"  塔:{team.get('towerKills', 0)}  "
                f"水晶:{team.get('inhibitorKills', 0)}  "
                f"巢虫:{team.get('hordeKills', 0)}"
            )
            print(
                f"  一血:{team.get('firstBlood')}  一塔:{team.get('firstTower')}  "
                f"一水晶:{team.get('firstInhibitor')}  一龙:{team.get('firstDargon')}  "
                f"一男爵:{team.get('firstBaron')}"
            )

        for p in detail.get("participants", []):
            print_player_detail(p, identities, "")

        print(f"\n{'='*70}")
        print(f"  数据获取完毕")
        print(f"{'='*70}\n")


if __name__ == "__main__":
    main()
