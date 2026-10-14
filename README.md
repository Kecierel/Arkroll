# 集成战略六星随机干员工具 v0.2.3

🌐 **在线使用：[集成战略六星随机工具](https://arkroll.pages.dev/)**

基于 React、TypeScript、Vite 的纯前端网站。按八职业各抽取一名六星干员，通过 GitHub 私有仓库与 Cloudflare Pages 持续发布。无需账号或后端。

## 功能

- 八职业随机抽取、锁定、单职业重抽、复制结果。
- 搜索干员，管理拥有与启用状态；抽取仅依据启用状态，未拥有但手动启用的干员也可参加。
- MAA 干员识别 JSON 预览导入，确认后全量覆盖干员库：已拥有设为拥有、启用；未拥有或未列出的设为未拥有、未启用。覆盖原手动选择，预览或取消不修改数据。
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

MAA 文件在浏览器本地解析，不上传服务器。拥有状态、启用状态、锁定和结果保存在当前网址的 localStorage。同浏览器不同网址（包括本地 HTML、localhost、预览网址与正式网址）不会自动共享配置，迁移前导出备份，到正式网址导入。

应用版本为 0.2.3；configVersion: 1 与存储键 arknights-is-randomizer:v1 是存储协议，保留不变。保持相同干员 ID 可保留原状态。

## 数据维护

手动编辑 src/data/operators.json，使用现有结构，并同步 updatedAt。也可使用 scripts/generate-operators.py 对本地来源文件交叉核对；它只输出公共字段，不输出个人拥有、等级或潜能。个人源文件放项目外或被忽略的 private/、local-data/ 中。

提交源码和 package-lock.json；不要提交 node_modules、dist、密钥或个人 MAA/备份文件。.gitignore 无法识别任意命名的私人 JSON，提交前仍须检查文件列表。

数据声明见 DATA_SOURCES.md 和 THIRD_PARTY_NOTICES.md；网页页脚也提供来源入口。本项目为非官方辅助工具，不连接或操作游戏。

旧版备份和浏览器配置中 settings.ownedOnly 会被忽略，干员状态、职业锁定和结果保留。新版不再导出此筛选字段。

## 许可证

本项目由 Kecierel 有权授权的原创代码和文档采用 [MIT License](LICENSE)，允许使用、修改、分发及商业使用，须保留版权和许可声明。Copyright (c) 2026 Kecierel。

此许可不重新授权《明日方舟》游戏名称、游戏数据、素材或第三方依赖；它们的权利归属及适用许可见 [第三方声明](THIRD_PARTY_NOTICES.md) 和 [数据来源](DATA_SOURCES.md)。
