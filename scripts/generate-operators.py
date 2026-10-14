"""Build public operator data from a MAA full roster and battle_data.json.

The MAA export may contain private ownership information. This script reads only
id, name, and rarity, and never copies own/elite/level/potential to output.
"""

import argparse
import datetime
import json
from collections import Counter
from pathlib import Path

PROFESSIONS = {
    "PIONEER": "先锋", "WARRIOR": "近卫", "TANK": "重装", "SNIPER": "狙击",
    "CASTER": "术师", "MEDIC": "医疗", "SUPPORT": "辅助", "SPECIAL": "特种",
}
ORDER = list(PROFESSIONS.values())


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--maa-export", type=Path, required=True)
    parser.add_argument("--battle-data", type=Path, required=True)
    parser.add_argument("--game-data", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--date", default=datetime.date.today().isoformat())
    args = parser.parse_args()

    roster = read_json(args.maa_export)
    battle = read_json(args.battle_data)["chars"]
    game = read_json(args.game_data)
    if not isinstance(roster, list) or not roster:
        raise ValueError("MAA export must be a nonempty array")

    ids = [item.get("id") for item in roster if isinstance(item, dict)]
    if len(ids) != len(roster) or len(ids) != len(set(ids)):
        raise ValueError("MAA export contains invalid or duplicate ids")

    operators = []
    for item in roster:
        if item.get("rarity") != 6:
            continue
        operator_id = item["id"]
        source = battle.get(operator_id)
        if not source:
            raise ValueError(f"No battle_data record for {operator_id}")
        if source.get("rarity") != 6 or source.get("name") != item.get("name"):
            raise ValueError(f"Name or rarity mismatch for {operator_id}")
        game_source = game.get(operator_id)
        if not game_source or game_source.get("name") != item.get("name") or game_source.get("rarity") != "TIER_6" or game_source.get("profession") != source.get("profession"):
            raise ValueError(f"Game data mismatch for {operator_id}")
        profession = PROFESSIONS.get(source.get("profession"))
        if not profession:
            raise ValueError(f"Invalid profession for {operator_id}")
        operators.append({"id": operator_id, "name": item["name"], "profession": profession, "rarity": 6})

    counts = Counter(operator["profession"] for operator in operators)
    if not operators or any(counts[p] == 0 for p in ORDER):
        raise ValueError("Every profession needs at least one six-star operator")
    operators.sort(key=lambda operator: (ORDER.index(operator["profession"]), operator["id"]))
    output = {"version": 1, "updatedAt": args.date, "operators": operators}
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(operators)} public operators; counts: {dict(counts)}")


if __name__ == "__main__":
    main()
