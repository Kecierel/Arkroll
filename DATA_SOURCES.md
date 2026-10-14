# v0.2 干员数据来源与核对

数据快照日期：**2026-10-14**。范围为国服简体中文、MAA 干员识别全量名单中的六星干员。`src/data/operators.json` 共 138 条：先锋 11、近卫 31、重装 15、狙击 17、术师 21、医疗 9、辅助 15、特种 19。

生成时使用了三份材料：

1. MAA“小工具 → 干员识别”导出的全量 JSON，用于确定客户端可用的干员 ID、名称及六星范围。该私人导出文件**未包含在项目中**，`own`、等级、潜能等个人字段也未写入公开数据。
2. [MaaResource 的 `resource/battle_data.json`](https://github.com/MaaAssistantArknights/MaaResource/blob/main/resource/battle_data.json)，提交 `858ba765825d804d711e4ade9875938746d9d7c5`，用于核对 ID、名称、星级与职业。
3. [ArknightsGameData 国服 `character_table.json`](https://github.com/Kengxxiao/ArknightsGameData/blob/master/zh_CN/gamedata/excel/character_table.json)，本次核对的文件 blob SHA `f7284f66cfd87273a6805142b389aa314320968f`，用于独立核对 ID、名称、`TIER_6` 与职业。

138 条记录在两份公开资源中的 ID、名称和职业全部匹配；MAA 星级 `6` 与游戏数据 `TIER_6` 全部匹配。MaaResource 另有集成战略临时干员及召唤物等记录，未加入普通干员库。

更新数据时使用 `scripts/generate-operators.py`，传入本地 MAA 全量导出、对应版本的 `battle_data.json` 和 `character_table.json`。脚本会拒绝重复 ID、字段冲突、非法职业及空职业；只输出 `id/name/profession/rarity`。更新后须重新运行测试和网站构建，再推送 GitHub 触发部署。

许可提示：MaaResource 仓库标注 AGPL-3.0；本地工具仅保留最小事实字段。发布保留上游来源、版本和适用许可信息，见 THIRD_PARTY_NOTICES.md。本文件记录数据出处，不代表已经完成公开发布许可审查。
