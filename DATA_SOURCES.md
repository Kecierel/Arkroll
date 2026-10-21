# v0.2 干员数据来源与核对

数据快照日期：**2026-10-14**。范围为国服简体中文、MAA 干员识别全量名单中的六星干员。`src/data/operators.json` 共 138 条：先锋 11、近卫 31、重装 15、狙击 17、术师 21、医疗 9、辅助 15、特种 19。

生成时使用了三份材料：

1. MAA“小工具 → 干员识别”导出的全量 JSON，用于确定客户端可用的干员 ID、名称及六星范围。该私人导出文件**未包含在项目中**，`own`、等级、潜能等个人字段也未写入公开数据。
2. [MaaResource 的 `resource/battle_data.json`](https://github.com/MaaAssistantArknights/MaaResource/blob/main/resource/battle_data.json)，提交 `858ba765825d804d711e4ade9875938746d9d7c5`，用于核对 ID、名称、星级与职业。
3. [ArknightsGameData 国服 `character_table.json`](https://github.com/Kengxxiao/ArknightsGameData/blob/master/zh_CN/gamedata/excel/character_table.json)，本次核对的文件 blob SHA `f7284f66cfd87273a6805142b389aa314320968f`，用于独立核对 ID、名称、`TIER_6` 与职业。

138 条记录在两份公开资源中的 ID、名称和职业全部匹配；MAA 星级 `6` 与游戏数据 `TIER_6` 全部匹配。MaaResource 另有集成战略临时干员及召唤物等记录，未加入普通干员库。

更新数据时使用 `scripts/generate-operators.py`，传入本地 MAA 全量导出、对应版本的 `battle_data.json` 和 `character_table.json`。脚本会拒绝重复 ID、字段冲突、非法职业及空职业；只输出 `id/name/profession/rarity`。更新后须重新运行测试和网站构建，再推送 GitHub 触发部署。

许可提示：MaaResource 仓库标注 AGPL-3.0；本地工具仅保留最小事实字段。发布保留上游来源、版本和适用许可信息，见 THIRD_PARTY_NOTICES.md。本文件记录数据出处，不代表已经完成公开发布许可审查。

## v0.3 默认头像

- 来源：[yuanyan3060/ArknightsGameResource](https://github.com/yuanyan3060/ArknightsGameResource/tree/9bf239661e37766fba585806fb9fa67e79bb679e/avatar)，固定提交 `9bf239661e37766fba585806fb9fa67e79bb679e`。
- 仅下载当前 138 名六星对应的 `avatar/<完整干员ID>.png`，排除追加 `_2` 的精二版本和所有皮肤；异格 ID 自带的 `2` 保留。
- 原始 PNG 合计 8,308,641 字节；逐文件核对 Git blob SHA，尺寸与 SHA-256 记录在 `public/avatars/avatar-manifest.json`。不修改原始素材、不下载半身像或立绘。
- 该项目为第三方整理仓库，README 声明静态资源版权属于 Arknights/上海鹰角网络科技有限公司，“仅用于学习和交流，侵删”。仓库 AGPL-3.0 标识不构成游戏图片权利人的授权，游戏素材不纳入本项目 MIT 许可。

### WebP 展示副本（2026-10-16）

原始 138 张 PNG 与原来源清单保持不变。网站展示副本由 `scripts/optimize-avatars.py` 使用 Pillow 转为 WebP（quality=85、method=6），保留 180×180 尺寸，逐张验证 alpha 通道与原图完全一致。压缩后共 1,890,866 字节，相比原始 8,308,641 字节减少 77.2%。输出及来源哈希记录于 `public/avatars/webp-manifest.json`，组件通过 `src/data/avatarImages.json` 引用带内容哈希的文件名。转换不改变游戏素材的权利归属与原版权声明。

## 六主题分队与招募组合（2026-10-21）

常规行动的分队名称、效果摘要、解锁条件及初始招募组合依据用户提供的PRTS主题页核对。使用页面当前已实装的扩展分队，不把月度预设小队或游戏生成的分队附加效果作为额外分队。

| 主题 | 分队数 | 招募组合数 | PRTS修订 |
| --- | --- | --- | --- |
| 傀影与猩红孤钻 | 10 | 4 | 441591 |
| 水月与深蓝之树 | 13 | 4 | 441598 |
| 探索者的银凇止境 | 13 | 4 | 441605 |
| 萨卡兹的无终奇语 | 17 | 4 | 441199 |
| 岁的界园志异 | 19 | 6 | 441542 |
| 沉沦者的黑流树海 | 17 | 6 | 442828 |

完整页面标题、核对日期、页面修订、原始HTML的SHA-256及提取名单见 src/data/openingSources.json；实现数据见 src/data/openings.ts 和 src/data/additionalOpenings.ts。原始页面仅在本地验证目录保留，运行时不联网读取。对名称和数量的自动测试使用从页面表格独立提取的清单；效果摘要经逐主题核对，区分基础、局外强化和难度附加条件。

水月和萨米职业分队提升随机直升概率；萨卡兹、岁、黑流树海适用首次对应职业通常招募直升，两职业共享首次机会。岁的职业战术分队招募及进阶各减1希望，其他后续主题分别减2与1。傀影、水月、萨米的随心所欲保底4星临时招募，后三主题保底5星；岁和黑流树海另有灵活部署、坚不可摧。初始随机券及异想天开、岁影回音的局内效果以游戏为准，不在工具中另行模拟。

黑流树海仍在更新，本次收录17个分队，包括内容拓展Ⅰ的团结阵线、踏足遍历；后续维护须重新核对页面，不能把本清单视为永久完整。

PRTS页面（各页可通过对应oldid查看本次修订）：
- [傀影与猩红孤钻](https://prts.wiki/index.php?title=傀影与猩红孤钻&oldid=441591)
- [水月与深蓝之树](https://prts.wiki/index.php?title=水月与深蓝之树&oldid=441598)
- [探索者的银凇止境](https://prts.wiki/index.php?title=探索者的银凇止境&oldid=441605)
- [萨卡兹的无终奇语](https://prts.wiki/index.php?title=萨卡兹的无终奇语&oldid=441199)
- [岁的界园志异](https://prts.wiki/index.php?title=岁的界园志异&oldid=441542)
- [沉沦者的黑流树海](https://prts.wiki/index.php?title=沉沦者的黑流树海&oldid=442828)

PRTS页脚声明：游戏内容权利归游戏权利人；除另有声明的内容外，网站其他内容采用CC BY-NC-SA 4.0。相应整理资料与摘要保留来源和适用声明，不纳入本项目代码的MIT许可。详见 THIRD_PARTY_NOTICES.md。
