"""
批量对局数据提取工具
====================
从 LCU API 拉取近期 N 场对局的全局战绩数据（不含 Timeline 逐帧数据），
输出为结构化 JSON 文件。

用法:
    python extract_matches.py                  # 默认拉取 10 场
    python extract_matches.py -n 20            # 拉取 20 场
    python extract_matches.py -o output.json   # 指定输出路径

每局包含:
  - 118 个 Stats 字段（KDA/伤害/治疗/经济/补刀/视野/控制/推塔/符文等）
  - 排位数据（各队列段位/胜率）
  - 英雄熟练度（仅本局使用的英雄）
"""

import json
import os
import sys

# 确保 Windows 终端中文不乱码
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# 将当前目录加入 path，确保可导入 lcu_client
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lcu_client import (
    LcuClient,
    extract_champion_mastery_for_game,
    extract_player_identity,
    extract_ranked_data,
    extract_stats_full,
    extract_team_data,
    find_lol_client,
)


def parse_args():
    """简易命令行参数解析"""
    import argparse
    parser = argparse.ArgumentParser(description="LCU 批量对局数据提取")
    parser.add_argument("-n", "--count", type=int, default=10, help="拉取对局数量 (默认 10)")
    parser.add_argument("-o", "--output", type=str, default="../output/matches.json", help="输出 JSON 路径")
    return parser.parse_args()


def main():
    args = parse_args()
    game_count = args.count
    output_path = args.output

    # 确保输出目录存在
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    print("=" * 65)
    print("  LCU API 批量对局数据提取")
    print("=" * 65)

    # ── 1. 连接 ──
    print("\n[1/4] 查找 LOL 客户端...")
    conn = find_lol_client()
    if not conn:
        print("  [ERROR] 未找到运行中的 LOL 客户端")
        return
    print(f"  [OK] port={conn.port}  region={conn.region}")
    client = LcuClient(conn)

    # ── 2. 召唤师 ──
    print("\n[2/4] 获取召唤师信息...")
    summoner = client.get_current_summoner()
    current_puuid = summoner["puuid"]
    print(f"  [OK] {summoner.get('displayName', 'N/A')}  Lv.{summoner['summonerLevel']}")

    # ── 3. 排位 + 英雄数据（公用的，只拉一次）──
    print("\n[3/4] 获取排位数据和英雄熟练度...")
    ranked = client.get_ranked_stats(current_puuid)
    ranked_summary = extract_ranked_data(ranked)
    all_mastery = client.get_champion_mastery()
    print(f"  [OK] 排位队列: {len(ranked_summary['queues'])} 个")
    print(f"  [OK] 英雄熟练度: {len(all_mastery)} 个")

    # ── 4. 战绩列表 ──
    print(f"\n[4/5] 获取战绩列表 (最近 {game_count} 场)...")
    end_index = max(game_count - 1, 0)
    history = client.get_match_history(current_puuid, beg=0, end=end_index)
    games = history["games"]["games"]
    print(f"  [OK] {len(games)} 场")

    # ── 5. 逐局详情 ──
    print(f"\n[5/5] 拉取每局全局数据...")
    all_games = []

    for i, game in enumerate(games):
        game_id = game["gameId"]
        detail = client.get_game_detail(game_id)
        identities = {
            i["participantId"]: i.get("player", {})
            for i in detail.get("participantIdentities", [])
        }

        # 整理两队的玩家
        blue_players = []
        red_players = []
        used_champion_ids = []

        for p in detail.get("participants", []):
            pid = p.get("participantId")
            player_info = identities.get(pid, {})
            cid = p.get("championId")
            used_champion_ids.append(cid)

            player_data = {
                **extract_player_identity(player_info),
                "champion_id": cid,
                "stats": extract_stats_full(p),
            }
            if p.get("teamId") == 100:
                blue_players.append(player_data)
            else:
                red_players.append(player_data)

        # 队伍数据
        teams = detail.get("teams", [])
        blue_team_data = extract_team_data(
            next((t for t in teams if t["teamId"] == 100), {}), blue_players
        )
        red_team_data = extract_team_data(
            next((t for t in teams if t["teamId"] == 200), {}), red_players
        )

        # 本局英雄熟练度
        game_mastery = extract_champion_mastery_for_game(all_mastery, used_champion_ids)

        game_record = {
            "game_id": game_id,
            "game_creation": game.get("gameCreationDate"),
            "game_duration_min": round(game.get("gameDuration", 0) / 60, 1),
            "game_mode": game.get("gameMode"),
            "game_type": game.get("gameType"),
            "queue_id": game.get("queueId"),
            "map_id": game.get("mapId"),
            "game_version": game.get("gameVersion"),
            "blue_team": blue_team_data,
            "red_team": red_team_data,
            "champion_mastery": game_mastery,
        }
        all_games.append(game_record)

        # 终端摘要
        bw = "W" if blue_team_data["win"] else "L"
        rw = "W" if red_team_data["win"] else "L"
        print(
            f"  #{game_id}  {game_record['game_mode']:14s}  "
            f"{game_record['game_duration_min']:5.1f}min  "
            f"蓝:{bw} 红:{rw}  "
            f"({len(blue_players)}v{len(red_players)})"
        )

    # ── 合并输出 ──
    output = {
        "summoner": {
            "puuid": current_puuid,
            "name": summoner.get("displayName", ""),
            "level": summoner.get("summonerLevel", 0),
            "region": conn.region,
            "platform": conn.rso_platform_id,
        },
        "ranked": ranked_summary,
        "champion_mastery_total": len(all_mastery),
        "games_count": len(all_games),
        "games": all_games,
    }

    abs_path = os.path.abspath(output_path)
    with open(abs_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    file_size_kb = round(len(json.dumps(output, ensure_ascii=False)) / 1024, 1)
    print(f"\n{'=' * 65}")
    print(f"  输出文件: {abs_path}  ({file_size_kb} KB)")
    print(f"  每局玩家数据: 118 个 Stats 字段 + 排位 + 英雄熟练度")
    print(f"{'=' * 65}")


if __name__ == "__main__":
    main()
