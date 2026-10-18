# Arkroll · 集成战略六星随机干员工具 v0.3.2

🌐 **在线使用：[集成战略六星随机工具](https://arkroll.pages.dev/)**

**当前最新干员：克莱门莎** <img src="public/avatars/char_4231_clemnt.png" alt="克莱门莎默认头像" width="48" height="48" />

基于 React、TypeScript、Vite 的纯前端网站。按八职业各抽取一名六星干员，通过 GitHub 仓库与 Cloudflare Pages 持续发布。无需账号或后端。

## 功能

- 抽取卡片和干员库展示六星干员默认（精零）头像，图片随网站部署；缺失或加载失败时显示职业占位。
- 八职业随机抽取、锁定、单职业重抽、复制结果。支持一键锁定全部已有结果及全部解锁；锁定后全局抽取保留已有结果，单职业“重抽”按钮禁用，解锁后恢复。
- 每次打开或刷新页面，八个职业均从“尚未抽取”开始；保留拥有、启用和锁定设置。在当前页面切换干员库或设置，不清空已抽取结果。
- 搜索干员，管理拥有与启用状态；抽取仅依据启用状态，未拥有但手动启用的干员也可参加。
- MAA 干员识别 JSON 预览导入，确认后全量覆盖干员库：已拥有设为拥有、启用；未拥有或未列出的设为未拥有、未启用。覆盖原手动选择，预览或取消不修改数据。
- 抽取历史与开局收藏：自动记录完整全局抽取，支持收藏、备注、复制、删除及校验后恢复。
- 当前浏览器保存配置，支持 JSON 备份、恢复和旧 SAMPLE 备份迁移。
- 内置公共干员库，数据随网站部署更新；新干员默认未拥有、已启用。

## 本地开发

使用 Node.js 24（版本约束见 .node-version 与 package.json）。Windows PowerShell 可使用 npm.cmd，避免 npm.ps1 执行策略问题。

```powershell
npm.cmd ci
npm.cmd run dev
```

打开终端显示的本地网址。生产验证：

```powershell
npm.cmd run test
npm.cmd run build
npm.cmd run preview -- --host 127.0.0.1
```

输出为 dist。index.html 是 Vite 源码入口，不能直接双击作为成品使用。本版本移除单文件 HTML 构建、PWA 安装与离线启动。

## Cloudflare Pages

- Git 仓库根目录即本项目根目录，生产分支 main。
- 使用 Pages 的 Git 集成，不使用 Workers 部署命令。
- 构建命令：npm run build；输出目录：dist；根目录留空。
- Node.js 24；必要时在构建环境设置 NODE_VERSION=24。
- 选择 React (Vite) 预设（如果提供），也可选 None 手动填写以上参数。
- 不需要运行时密钥、数据库或 Cloudflare API Token。
- 页面入口每次重新校验，带哈希的静态资源可长期缓存，见 public/_headers。

## 数据与隐私

src/data/operators.json 是公共干员库，只保存稳定 ID、名称、职业、星级。来源和日期见 DATA_SOURCES.md。新增数据后先通过测试与构建，再推送发布。不在浏览器中自动连接外部数据源。

MAA 文件在浏览器本地解析，不上传服务器。拥有状态、启用状态和锁定设置保存在当前网址的 localStorage；每次打开或刷新页面都会清空上次结果。显式导入 JSON 备份仍可在当前页面恢复备份结果，下一次打开或刷新时仍从“尚未抽取”开始。同浏览器不同网址（包括本地 HTML、localhost、预览网址与正式网址）不会自动共享配置，迁移前导出备份，到正式网址导入。

应用版本为 0.3.2；configVersion: 1 与存储键 arknights-is-randomizer:v1 是存储协议，保留不变。保持相同干员 ID 可保留原状态。

## 数据维护

手动编辑 src/data/operators.json，使用现有结构，并同步 updatedAt。也可使用 scripts/generate-operators.py 对本地来源文件交叉核对；它只输出公共字段，不输出个人拥有、等级或潜能。个人源文件放项目外或被忽略的 private/、local-data/ 中。

提交源码和 package-lock.json；不要提交 node_modules、dist、密钥或个人 MAA/备份文件。.gitignore 无法识别任意命名的私人 JSON，提交前仍须检查文件列表。

数据声明见 DATA_SOURCES.md 和 THIRD_PARTY_NOTICES.md；网页页脚也提供来源入口。本项目为非官方辅助工具，不连接或操作游戏。

头像位于 public/avatars，来自 ArknightsGameResource 固定快照；avatar-manifest.json 记录源路径、版本、尺寸及哈希。只使用与干员完整 ID 精确对应的默认头像，不使用额外的 `_2` 精二或皮肤版本。原始 PNG 保留用于来源校验与 README；网站使用 public/avatars/webp 中的压缩副本，138 张共约 **1.80 MiB**，比原始 PNG 的 7.92 MiB 减少 **77.2%**，保持 180×180 尺寸和原透明通道。进入网页即以低优先级预加载全部 WebP 头像，供后续抽取和干员库复用浏览器缓存；当前抽取结果仍以高优先级加载。首次访问会提前下载约 1.80 MiB，实际缓存复用受浏览器缓存策略影响。头像与 JSON 备份分离，不增加浏览器个人存储体积。

运行 `node scripts/download-avatars.mjs` 可校验并补齐原始快照；此命令联网，不在构建时自动执行。随后使用安装了 Pillow 且支持 WebP 的 Python 运行 `python scripts/optimize-avatars.py`，生成质量 85 的 WebP、webp-manifest.json 和 src/data/avatarImages.json。压缩清单记录来源哈希和输出哈希；生成脚本校验尺寸与透明通道。图片文件名带内容哈希，更新后自动生成新路径，无需手工修改组件版本参数。生成的图片和映射需一起提交；常规 npm 构建无需 Python。

Cloudflare Pages 的 `/avatars/*` 配置浏览器缓存一周，减少已加载头像的重复联网校验。WebP 使用带内容哈希的路径更新缓存；压缩减少首次加载流量，但不消除网络连接延迟。

旧版备份和浏览器配置中 settings.ownedOnly 会被忽略，干员状态、职业锁定和结果保留。新版不再导出此筛选字段。

## 许可证

本项目由 Kecierel 有权授权的原创代码和文档采用 [MIT License](LICENSE)，允许使用、修改、分发及商业使用，须保留版权和许可声明。Copyright (c) 2026 Kecierel。

此许可不重新授权《明日方舟》游戏名称、游戏数据、素材或第三方依赖；它们的权利归属及适用许可见 [第三方声明](THIRD_PARTY_NOTICES.md) 和 [数据来源](DATA_SOURCES.md)。

## 开发说明

本项目主要借助 OpenAI Codex 进行开发，包括代码编写、界面实现、测试及文档整理。项目需求、功能取舍和实际使用验收由维护者负责。

欢迎反馈问题或提出改进建议。

## 抽取历史与开局收藏

完整全局抽取自动保存独立的八职业快照、时间和候选人数/锁定规则摘要；单职业重抽不自动新增历史，可用“收藏开局”手动保存当前完整阵容。未收藏历史最多30条，超出自动移除最早记录；收藏独立保留最多100条，达到上限会提示。备注最多500字，修改即时保存。

历史不随干员启用状态或当前结果变化。恢复时逐职业检查现有6★干员资格，失效职业明确提示并留空，保留当前职业锁定，不修改干员库。清理历史只删除未收藏记录；单条删除及全部清除均需确认。刷新保留历史、收藏及备注，同时清空当前结果。

JSON备份包含历史与收藏；导入会覆盖全部设置及记录，旧版不含历史的备份会清空记录。记录仅保存在当前网址的浏览器中。
