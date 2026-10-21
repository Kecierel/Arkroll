# 第三方来源与声明

本网站为非官方《明日方舟》辅助工具，与游戏开发商、发行商和 MAA 项目无隶属关系。游戏名称及相关权利归原权利人所有。

## 公共干员事实字段

数据仅包含 id、name、profession、rarity，不包含立绘、音频、剧情或个人持有数据。数据快照与交叉核对记录见 DATA_SOURCES.md。来源仓库的声明不等同于游戏权利人的授权，也不应被解释为本项目拥有这些游戏资料的权利。

- MaaAssistantArknights/MaaResource：https://github.com/MaaAssistantArknights/MaaResource ，核对提交 858ba765825d804d711e4ade9875938746d9d7c5。该仓库 LICENSE 为 GNU AGPL v3，原文副本随站点保留于 public/licenses/MaaResource-AGPL-3.0.txt。本项目未复制其程序代码，使用 battle_data.json 核对最小干员事实字段。
- Kengxxiao/ArknightsGameData：https://github.com/Kengxxiao/ArknightsGameData ，国服 character_table.json 文件 blob f7284f66cfd87273a6805142b389aa314320968f。README 说明其数据基于 OpenArknightsFBS 解析：https://github.com/MooncellWiki/OpenArknightsFBS 。此次读取到的 README 未声明可据此替游戏权利人授予许可，不对其许可作额外推断。
- MAA 个人导出仅供本地核对和用户导入；没有打包或上传个人文件。

## 干员头像（v0.3）

138 张默认头像来自第三方整理的 [yuanyan3060/ArknightsGameResource](https://github.com/yuanyan3060/ArknightsGameResource)，提交 `9bf239661e37766fba585806fb9fa67e79bb679e` 的 avatar 目录。原文件、尺寸和哈希见 public/avatars/avatar-manifest.json。

上游 README 声明：“本项目所有静态资源，版权均属于Arknights/上海鹰角网络科技有限公司，仅用于学习和交流，侵删。”本网站保留该来源声明；此仓库不是鹰角官方发布仓库。仓库 LICENSE 为 AGPL-3.0，原文副本保留在 public/licenses/ArknightsGameResource-AGPL-3.0.txt；该仓库许可标识不应被解释为鹰角对游戏素材的授权，头像也不受本项目 MIT 许可重新授权。

## 网页运行依赖

React 与 React DOM 使用 MIT 许可，完整声明随站点提供于 public/licenses/react-MIT.txt 和 public/licenses/react-dom-MIT.txt。构建工具留在开发依赖中，不作为网页服务运行。

网页可见的来源入口为 /data-sources.html。本项目由 Kecierel 有权授权的原创代码和文档采用根目录 LICENSE 中的 MIT 许可。本说明中的上游游戏数据、素材和第三方依赖不因该许可而重新授权，继续保留各自权利与适用许可。

## PRTS集成战略主题资料

六主题的分队、效果摘要、解锁条件与招募组合整理自PRTS，核对日期2026-10-21。各页链接、修订与资料范围见 DATA_SOURCES.md 和 src/data/openingSources.json。摘要对原页面内容进行了精简，区分了主题、难度及强化条件；不是完整游戏规则的替代品。

PRTS页脚声明游戏相关内容版权属于上海鹰角网络科技有限公司及其关联公司；除另有声明外，网站其他内容采用[知识共享署名-非商业性使用-相同方式共享4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)。本项目中的相应资料整理与改写摘要保留适用的来源和许可声明，不纳入代码的MIT许可，亦不改变游戏资料的权利归属。
