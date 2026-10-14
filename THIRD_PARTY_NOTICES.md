# 第三方来源与声明

本网站为非官方《明日方舟》辅助工具，与游戏开发商、发行商和 MAA 项目无隶属关系。游戏名称及相关权利归原权利人所有。

## 公共干员事实字段

数据仅包含 id、name、profession、rarity，不包含立绘、音频、剧情或个人持有数据。数据快照与交叉核对记录见 DATA_SOURCES.md。来源仓库的声明不等同于游戏权利人的授权，也不应被解释为本项目拥有这些游戏资料的权利。

- MaaAssistantArknights/MaaResource：https://github.com/MaaAssistantArknights/MaaResource ，核对提交 858ba765825d804d711e4ade9875938746d9d7c5。该仓库 LICENSE 为 GNU AGPL v3，原文副本随站点保留于 public/licenses/MaaResource-AGPL-3.0.txt。本项目未复制其程序代码，使用 battle_data.json 核对最小干员事实字段。
- Kengxxiao/ArknightsGameData：https://github.com/Kengxxiao/ArknightsGameData ，国服 character_table.json 文件 blob f7284f66cfd87273a6805142b389aa314320968f。README 说明其数据基于 OpenArknightsFBS 解析：https://github.com/MooncellWiki/OpenArknightsFBS 。此次读取到的 README 未声明可据此替游戏权利人授予许可，不对其许可作额外推断。
- MAA 个人导出仅供本地核对和用户导入；没有打包或上传个人文件。

## 网页运行依赖

React 与 React DOM 使用 MIT 许可，完整声明随站点提供于 public/licenses/react-MIT.txt 和 public/licenses/react-dom-MIT.txt。构建工具留在开发依赖中，不作为网页服务运行。

网页可见的来源入口为 /data-sources.html。本说明保留来源及适用声明，不擅自为上游数据或本项目整体指定新的开源许可。
