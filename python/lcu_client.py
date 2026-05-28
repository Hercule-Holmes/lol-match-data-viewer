"""
LCU API 共享客户端模块
======================
提供 LCU 连接发现、HTTP 请求封装、以及全维度 Stats 数据提取。

独立模块 —— 不依赖 LeagueAkari 或任何第三方项目代码。
"""

import re
import subprocess
from dataclasses import dataclass
from typing import Optional

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


# ═══════════════════════════════════════════════════════════
# 连接层
# ═══════════════════════════════════════════════════════════

@dataclass
class LcuConnection:
    """LCU 客户端连接信息"""
    port: int
    auth_token: str
    pid: int = 0
    region: str = ""
    rso_platform_id: str = ""

    @property
    def base_url(self) -> str:
        return f"https://127.0.0.1:{self.port}"


class LcuClient:
    """LCU API HTTP 客户端"""

    def __init__(self, conn: LcuConnection):
        self._conn = conn
        self._session = requests.Session()
        self._session.auth = ("riot", conn.auth_token)
        self._session.verify = False
        self._session.headers.update({"Accept": "application/json"})

    def _get(self, endpoint: str) -> dict:
        url = f"{self._conn.base_url}{endpoint}"
        resp = self._session.get(url, timeout=15)
        resp.raise_for_status()
        return resp.json()

    def get_current_summoner(self) -> dict:
        return self._get("/lol-summoner/v1/current-summoner")

    def get_match_history(self, puuid: str, beg: int = 0, end: int = 19) -> dict:
        return self._get(
            f"/lol-match-history/v1/products/lol/{puuid}/matches?begIndex={beg}&endIndex={end}"
        )

    def get_game_detail(self, game_id: int) -> dict:
        return self._get(f"/lol-match-history/v1/games/{game_id}")

    def get_ranked_stats(self, puuid: str) -> dict:
        return self._get(f"/lol-ranked/v1/ranked-stats/{puuid}")

    def get_champion_mastery(self) -> list:
        return self._get("/lol-champion-mastery/v1/local-player/champion-mastery")


# ═══════════════════════════════════════════════════════════
# 进程发现
# ═══════════════════════════════════════════════════════════

def find_lol_client() -> Optional[LcuConnection]:
    """通过进程命令行发现正在运行的 LCU 客户端连接凭据"""
    try:
        ps_cmd = (
            'powershell -Command "'
            "Get-CimInstance Win32_Process -Filter \\\"name = 'LeagueClientUx.exe'\\\" | "
            'Select-Object -ExpandProperty CommandLine'
            '"'
        )
        result = subprocess.run(ps_cmd, capture_output=True, text=True, shell=True, timeout=10)
        cmdline = result.stdout.strip()
        if not cmdline:
            return None

        def _extract(pattern: str, text: str) -> str:
            m = re.search(pattern, text)
            return m.group(1) if m else ""

        port = _extract(r'--app-port=(\d+)', cmdline)
        token = _extract(r'--remoting-auth-token=([\w\-_]+)', cmdline)
        if not port or not token:
            return None

        return LcuConnection(
            port=int(port),
            auth_token=token,
            pid=int(_extract(r'--app-pid=(\d+)', cmdline) or 0),
            region=_extract(r'--region=([\w\-_]+)', cmdline),
            rso_platform_id=_extract(r'--rso_platform_id=([\w\-_]+)', cmdline),
        )
    except Exception as e:
        print(f"  [ERROR] 查找 LOL 客户端失败: {e}")
        return None


# ═══════════════════════════════════════════════════════════
# 数据提取
# ═══════════════════════════════════════════════════════════

def _safe_int(v) -> int:
    return v if isinstance(v, (int, float)) else 0


def extract_player_identity(player_info: dict) -> dict:
    """提取玩家身份信息（兼容国服 gameName#tagLine 体系）"""
    raw_name = player_info.get("summonerName", "")
    game_name = player_info.get("gameName", "")
    tag_line = player_info.get("tagLine", "")
    return {
        "puuid": player_info.get("puuid", ""),
        "summoner_name": raw_name or (f"{game_name}#{tag_line}" if game_name else ""),
        "profile_icon_id": player_info.get("profileIcon", 0),
        "summoner_id": player_info.get("summonerId", 0),
    }


def extract_stats_full(participant: dict) -> dict:
    """提取全部 118 个 Stats 字段 + 参与者层级字段，按维度分组"""
    stats = participant.get("stats", {})
    kills = _safe_int(stats.get("kills"))
    deaths = _safe_int(stats.get("deaths"))
    assists = _safe_int(stats.get("assists"))

    return {
        # ── KDA & 多杀 ──
        "kills": kills,
        "deaths": deaths,
        "assists": assists,
        "kda": round((kills + assists) / max(deaths, 1), 2),
        "kda_ratio": f"{kills}/{deaths}/{assists}",
        "largest_multi_kill": stats.get("largestMultiKill"),
        "largest_killing_spree": stats.get("largestKillingSpree"),
        "killing_sprees": stats.get("killingSprees"),
        "double_kills": stats.get("doubleKills"),
        "triple_kills": stats.get("tripleKills"),
        "quadra_kills": stats.get("quadraKills"),
        "penta_kills": stats.get("pentaKills"),
        "unreal_kills": stats.get("unrealKills"),

        # ── 伤害明细（12 个维度）──
        "damage": {
            "total_to_champs": stats.get("totalDamageDealtToChampions"),
            "total_dealt": stats.get("totalDamageDealt"),
            "total_taken": stats.get("totalDamageTaken"),
            "physical_to_champs": stats.get("physicalDamageDealtToChampions"),
            "physical_dealt": stats.get("physicalDamageDealt"),
            "physical_taken": stats.get("physicalDamageTaken"),
            "magic_to_champs": stats.get("magicDamageDealtToChampions"),
            "magic_dealt": stats.get("magicDamageDealt"),
            "magic_taken": stats.get("magicalDamageTaken"),
            "true_to_champs": stats.get("trueDamageDealtToChampions"),
            "true_dealt": stats.get("trueDamageDealt"),
            "true_taken": stats.get("trueDamageTaken"),
            "largest_critical_strike": stats.get("largestCriticalStrike"),
        },

        # ── 经济 ──
        "economy": {
            "gold_earned": stats.get("goldEarned"),
            "gold_spent": stats.get("goldSpent"),
        },

        # ── 补刀 ──
        "cs": {
            "total": _safe_int(stats.get("totalMinionsKilled")) + _safe_int(stats.get("neutralMinionsKilled")),
            "minions": stats.get("totalMinionsKilled"),
            "neutral_total": stats.get("neutralMinionsKilled"),
            "neutral_enemy_jungle": stats.get("neutralMinionsKilledEnemyJungle"),
            "neutral_team_jungle": stats.get("neutralMinionsKilledTeamJungle"),
        },

        # ── 装备（7 格 + 守卫）──
        "items": [stats.get(f"item{i}") for i in range(7)],

        # ── 符文（完整符文页）──
        "runes": {
            "primary_style": stats.get("perkPrimaryStyle"),
            "sub_style": stats.get("perkSubStyle"),
            "perks": [stats.get(f"perk{i}") for i in range(6)],
            "perk_vars": {
                f"perk{i}": [
                    stats.get(f"perk{i}Var1"),
                    stats.get(f"perk{i}Var2"),
                    stats.get(f"perk{i}Var3"),
                ]
                for i in range(6)
            },
        },

        # ── 视野 ──
        "vision": {
            "score": stats.get("visionScore"),
            "wards_placed": stats.get("wardsPlaced"),
            "wards_killed": stats.get("wardsKilled"),
            "sight_wards_bought": stats.get("sightWardsBoughtInGame"),
            "vision_wards_bought": stats.get("visionWardsBoughtInGame"),
        },

        # ── 推塔 & 目标 ──
        "objectives": {
            "turret_kills": stats.get("turretKills"),
            "inhibitor_kills": stats.get("inhibitorKills"),
            "damage_to_turrets": stats.get("damageDealtToTurrets"),
            "damage_to_objectives": stats.get("damageDealtToObjectives"),
        },

        # ── 控制 ──
        "cc": {
            "time_cc_others": stats.get("timeCCingOthers"),
            "total_cc_dealt": stats.get("totalTimeCrowdControlDealt"),
        },

        # ── 生存 & 治疗 ──
        "survival": {
            "longest_time_living": stats.get("longestTimeSpentLiving"),
            "damage_self_mitigated": stats.get("damageSelfMitigated"),
            "total_heal": stats.get("totalHeal"),
            "total_units_healed": stats.get("totalUnitsHealed"),
        },

        # ── 等级 ──
        "champ_level": stats.get("champLevel"),

        # ── 先锋事件 ──
        "firsts": {
            "first_blood_kill": stats.get("firstBloodKill"),
            "first_blood_assist": stats.get("firstBloodAssist"),
            "first_tower_kill": stats.get("firstTowerKill"),
            "first_tower_assist": stats.get("firstTowerAssist"),
            "first_inhibitor_kill": stats.get("firstInhibitorKill"),
            "first_inhibitor_assist": stats.get("firstInhibitorAssist"),
        },

        # ── 召唤师技能（从参与者层级提取）──
        "summoner_spells": {
            "spell1": participant.get("spell1Id"),
            "spell2": participant.get("spell2Id"),
        },

        # ── 位置（仅排位模式有值）──
        "position": {
            "individual_position": stats.get("individualPosition", ""),
            "team_position": stats.get("teamPosition", ""),
            "lane": stats.get("lane", ""),
        },

        # ── 投降 ──
        "surrender": {
            "game_ended_in_surrender": stats.get("gameEndedInSurrender"),
            "game_ended_in_early_surrender": stats.get("gameEndedInEarlySurrender"),
            "game_ended_in_ignb_surrender": stats.get("gameEndedInIGNBSurrender"),
            "team_early_surrendered": stats.get("teamEarlySurrendered"),
            "caused_early_surrender": stats.get("causedEarlySurrender"),
            "caused_game_end_from_ignb_surrender": stats.get("causedGameEndFromIGNBSurrender"),
            "early_surrender_accomplice": stats.get("earlySurrenderAccomplice"),
        },

        # ── 斗魂竞技场 ──
        "arena": {
            "subteam_placement": stats.get("subteamPlacement"),
            "player_subteam_id": stats.get("playerSubteamId"),
            "player_augments": [stats.get(f"playerAugment{i}") for i in range(1, 7)],
        },

        # ── 综合评分 ──
        "scores": {
            "combat": stats.get("combatPlayerScore"),
            "objective": stats.get("objectivePlayerScore"),
            "total": stats.get("totalPlayerScore"),
            "rank": stats.get("totalScoreRank"),
            "details": [stats.get(f"playerScore{i}") for i in range(10)],
        },

        # ── 角色限定装备 ──
        "role_bound_item": stats.get("roleBoundItem"),

        # ── 行为标记 ──
        "was_severe_transgressor": stats.get("wasSevereTransgressor"),

        # ── 胜负 ──
        "win": stats.get("win"),
    }


def extract_team_data(team: dict, players: list[dict]) -> dict:
    """提取队伍维度的汇总数据"""
    return {
        "team_id": team.get("teamId"),
        "win": team.get("win") == "Win",
        "bans": team.get("bans", []),
        "baron_kills": team.get("baronKills", 0),
        "dragon_kills": team.get("dragonKills", 0),
        "rift_herald_kills": team.get("riftHeraldKills", 0),
        "vilemaw_kills": team.get("vilemawKills", 0),
        "horde_kills": team.get("hordeKills", 0),
        "tower_kills": team.get("towerKills", 0),
        "inhibitor_kills": team.get("inhibitorKills", 0),
        "first_blood": team.get("firstBlood", False),
        "first_tower": team.get("firstTower", False),
        "first_inhibitor": team.get("firstInhibitor", False),
        "first_baron": team.get("firstBaron", False),
        "first_dragon": team.get("firstDargon", False),  # LCU 拼写如此
        "players": players,
    }


def extract_ranked_data(ranked_stats: dict) -> dict:
    """提取排位核心数据"""
    queues = ranked_stats.get("queues", [])
    result = {}
    for q in queues:
        queue_type = q.get("queueType", "UNKNOWN")
        result[queue_type] = {
            "tier": q.get("tier", ""),
            "division": q.get("division", ""),
            "league_points": q.get("leaguePoints", 0),
            "wins": q.get("wins", 0),
            "losses": q.get("losses", 0),
            "win_rate": (
                round(q.get("wins", 0) / max(q.get("wins", 0) + q.get("losses", 0), 1) * 100, 1)
                if (q.get("wins") or q.get("losses"))
                else 0
            ),
        }
    return {
        "highest_current_tier": ranked_stats.get("highestCurrentSeasonReachedTierSR", ""),
        "highest_previous_tier": ranked_stats.get("highestPreviousSeasonEndTier", ""),
        "queues": result,
    }


def extract_champion_mastery_for_game(
    mastery_list: list, played_champion_ids: list[int]
) -> dict:
    """为对局中使用过的英雄提取熟练度"""
    result = {}
    for m in mastery_list:
        cid = m.get("championId")
        if cid in played_champion_ids:
            result[str(cid)] = {
                "level": m.get("championLevel"),
                "points": m.get("championPoints"),
                "highest_grade": m.get("highestGrade"),
                "last_play_time": m.get("lastPlayTime"),
            }
    return result
