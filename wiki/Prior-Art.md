# 其他客户端与先行实现

本页记录其他开源 E-Hentai 客户端 / 工具的做法，以及它们反映出的站点变迁。来源全部是第三方（【社区】），日期是对方提交或 issue 的日期，不一定等于站点改版的日期。调研时间 2026-10-10。

## 1. 资料可用性

| 项目 | 状态 | 说明 |
|---|---|---|
| [JHenTai](https://github.com/jiangtian616/JHenTai)（Flutter） | 可读，`c1470866ef`（2026-09-26） | 本页最主要的对照来源 |
| [EhViewer-NekoInverter](https://github.com/EhViewer-NekoInverter/EhViewer)（Kotlin，EhViewer 分支） | 可读，`634b281c69`（2026-07-28） | |
| [EhPanda](https://github.com/EhPanda-Team/EhPanda)（iOS） | 可读，`37b979965c`（2026-07-20） | 有保存的封禁页夹具 |
| [xiaojieonly/Ehviewer_CN_SXJ](https://github.com/xiaojieonly/Ehviewer_CN_SXJ)（Ehviewer-Lab 的上游） | 可读 | issue 区是中国大陆网络环境的一手反馈 |
| [mikf/gallery-dl](https://github.com/mikf/gallery-dl) | **部分**：GitHub 上已没有 exhentai 提取器的源码，只能读文档和 issue | 2026-03 因 DMCA 改写历史，开发转到 Codeberg（[#9374](https://github.com/mikf/gallery-dl/issues/9374)） |
| FooIbar/EhViewer、Ehviewer-Overhauled/Ehviewer | **不可读**（HTTP 451） | 被下面那份 DMCA 通知封禁 |
| [LANraragi](https://github.com/Difegue/LANraragi)、[lifegpc/eh-downloader](https://github.com/lifegpc/eh-downloader)、[ccloli/E-Hentai-Downloader](https://github.com/ccloli/E-Hentai-Downloader)、[moycat/PandaProxy](https://github.com/moycat/PandaProxy) | 可读 | |

### DMCA 通知（2026-03-23）

[FAKKU 的 DMCA 通知](https://github.com/github/dmca/blob/master/2026/03/2026-03-23-fakku.md)由 Remove Your Media LLC 代发，依据是 17 U.S.C. § 1201（规避访问控制）。理由是这些仓库提供了自动化访问盗版站点的工具。通知点名了 29 个仓库，其中与 E-Hentai 相关的有 gallery-dl、Ehviewer-Overhauled、FooIbar/EhViewer、FEhViewer、E-Viewer、SadPanda、LANraragi。【核实：本页作者直接读了通知原文】

HicirTech 的仓库、SXJ、JHenTai、NekoInverter、eh-downloader 都不在可见的条目里。通知里有 3 个条目没有显示 URL（第 11、28 条和第二个 23 条）。

## 2. 站点变迁（从其他客户端反推）

| # | 变化 | 时间 | 来源 | Ehviewer-Lab 的情况 |
|---|---|---|---|---|
| S1 | 列表改为游标翻页：`next=<gid>`、`prev=<gid>`、`seek=YYYY-MM-DD`；「最后一页」链接是 `prev=1`；导航 id 是小写的 `#ufirst #uprev #ujumpbox #unext #ulast` | 里站 2022-11-02，表站 2022-11-05 | [EhPanda #285](https://github.com/EhPanda-Team/EhPanda/issues/285)、JHenTai v5.0.0 / v5.1.0 | 已支持（见[站点地图](Site-Map.md)）；但「第一页」id 的大小写不对 |
| S4 | 里站缩略图和封面移到 `s.exhentai.org/t/…`，这个主机也要带登录 cookie | 2023-05 | [NekoInverter 5715dfc73f](https://github.com/EhViewer-NekoInverter/EhViewer/commit/5715dfc73f)、[EhPanda bc6c3b19c9](https://github.com/EhPanda-Team/EhPanda/commit/bc6c3b19c9) | 客户端把缩略图统一改写到 `ehgt.org`。里站独有的画廊在 ehgt.org 上有没有缩略图，未验证 |
| S5 | 详情页缩略图 DOM 改版：`#gdt` 带 class；缩略图 URL 变成**相对主机**的路径；新增第三档缩略图大小，以及缩略图下方的页码标注。社区的应对办法：大小设 Normal，标注设 None | 站点 2024-10-15；各客户端在 10-16 至 10-28 修复 | [JHenTai 460761d6da](https://github.com/jiangtian616/JHenTai/commit/460761d6da)、[EhPanda #387](https://github.com/EhPanda-Team/EhPanda/issues/387)、[SXJ #1482](https://github.com/xiaojieonly/Ehviewer_CN_SXJ/issues/1482) | 正则已经覆盖带标注的版本，但相对 URL 会原样保留。【推断：可能出问题，没有样本】 |
| S6 | 缩略图 URL 家族：`ehgt.org/…jpg`、`ehgt.org/w/…webp`、`s.exhentai.org/t/…`、`s.exhentai.org/w/…`；预览图在 `*.hath.network/cm`、`c1`、`c2` 上，带**有时效的 token**，所以缓存 key 必须用 gid + 序号，不能用 URL | 2024-10 | [NekoInverter EhCacheKeyFactory.kt](https://github.com/EhViewer-NekoInverter/EhViewer/blob/634b281c69/app/src/main/java/com/hippo/ehviewer/client/EhCacheKeyFactory.kt#L20-L38) | 缓存 key 本来就按 gid / 序号生成 |
| S7 | `datatags=1`（URL 参数或 cookie）会在页面里附带原图的 SHA-1；NekoInverter 因此也接受 40 位十六进制的页 token | 2024-10 至 2025-06 | [NekoInverter f23f1aa029](https://github.com/EhViewer-NekoInverter/EhViewer/commit/f23f1aa029) | 只接受 10 位 token |
| S10 | 归档的 `or` 参数不再是必需的；表站和里站的归档页都改过 | 2024-10-27 至 10-31 | [LANraragi #1101](https://github.com/Difegue/LANraragi/issues/1101) | `ArchiveParser` 未复核 |
| S11 | 单页 `/s/` 改版：原图链接从 `#i7` 移到 `#i6` | 2023-10-27；里站 2023-11-25 | [JHenTai 6b9824bab6](https://github.com/jiangtian616/JHenTai/commit/6b9824bab6)、[gallery-dl #4905](https://github.com/mikf/gallery-dl/issues/4905) | 已兼容（[`client/parser/GalleryPageApiParser.java:60-68`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryPageApiParser.java#L60-L68)） |
| S12 | 原图 URL 新形式 `/fullimg/<gid>/<page>/<key>/<name>`，302 跳到 `*.hath.network` 节点（旧形式是 `fullimg.php?gid=&page=&key=`） | 日志见于 2024-11、2026-03 | [gallery-dl #6504](https://github.com/mikf/gallery-dl/issues/6504)、[#9259](https://github.com/mikf/gallery-dl/issues/9259) | 两种都能匹配（按 `fullimg` 拆分） |
| S13 | MPV：`/mpv/<gid>/<token>/` 页面里有 `var imagelist`（`k` 就是 ptoken）和 `mpvkey`；API 方法 `imagedispatch` 带 `gid, page, imgkey, mpvkey[, nl]`；能不能用取决于 `hath_perks` cookie 里的 `q` 标志。账号的阅读器设置为 MPV 时，`/s/` 页面会变样 | 2022 至 2026 | [EhPanda Request.swift](https://github.com/EhPanda-Team/EhPanda/blob/37b979965c/EhPanda/Network/Request.swift#L633-L646)、[gallery-dl v1.31.5](https://github.com/mikf/gallery-dl/releases/tag/v1.31.5)、[JHenTai eh_spider_parser.dart](https://github.com/jiangtian616/JHenTai/blob/c1470866ef/lib/src/utils/eh_spider_parser.dart#L583-L585) | 没有 MPV。如果账号设成 MPV，单页解析会失败 |
| S14 | API 地址各家不一：NekoInverter 用表站 `api.e-hentai.org/api.php`、里站 `s.exhentai.org/api.php`；JHenTai 用表站 `api.e-hentai.org`、里站 `exhentai.org/api.php`；gallery-dl 用 `s.exhentai.org/api.php` | 2023-10 起 | [NekoInverter dd5045f6aa](https://github.com/EhViewer-NekoInverter/EhViewer/commit/dd5045f6aa)、[JHenTai eh_consts.dart](https://github.com/jiangtian616/JHenTai/blob/c1470866ef/lib/src/consts/eh_consts.dart#L18-L22) | 用 `e-hentai.org/api.php` 和 `exhentai.org/api.php`，是 2023-10 之前的写法。表站这个地址现在是否仍可用，未验证 |
| S15 | gallery-dl 调 `s.exhentai.org/api.php` 的 `showpage` 时，返回「缺参数」错误；2026-07-27 修复，缺的是哪个参数不清楚 | 2026-07-26 | [gallery-dl #9676](https://github.com/mikf/gallery-dl/issues/9676) | 是否受影响，未知 |
| S16 | 以图搜图的主机各家不一：`upload.e-hentai.org` / `exhentai.org/upload/`（NekoInverter），`upld.e-hentai.org` / `exhentai.org/upld/`（JHenTai） | 2026 | [NekoInverter EhUrl.kt](https://github.com/EhViewer-NekoInverter/EhViewer/blob/634b281c69/app/src/main/java/com/hippo/ehviewer/client/EhUrl.kt#L33-L34) | 用 `upld.e-hentai.org` / `upld.exhentai.org/upld/`，未定论 |
| S18 | 中国大陆可达性：部分里站 IP（178.175.x.x）被重置；DoH 77.88.8.1 的证书链在旧 Android 根证书库上验证失败；有人声称里站「必须带 SNI」、内置 IP 已失效（维护者有异议） | 2026-02 至 2026-09 | [SXJ #2441](https://github.com/xiaojieonly/Ehviewer_CN_SXJ/issues/2441)、[#2845](https://github.com/xiaojieonly/Ehviewer_CN_SXJ/issues/2845)、[#2871](https://github.com/xiaojieonly/Ehviewer_CN_SXJ/issues/2871) | 内置 IP 表和 DoH 与上游完全相同 |
| S25 | 账号密码登录遇到验证码 | 2024-03 至 2024-09 | [gallery-dl #5492](https://github.com/mikf/gallery-dl/issues/5492)、NekoInverter | 没有验证码处理 |
| S27 | **论坛 `forums.e-hentai.org` 前面加了 Cloudflare 挑战**，脚本直接 POST 登录返回 403，网页（WebView）登录仍然可用；里站本身据称不在 Cloudflare 后面 | 2025-12 起 | [JHenTai #712](https://github.com/jiangtian616/JHenTai/issues/712)（本页作者已核实）、[gallery-dl #9012](https://github.com/mikf/gallery-dl/issues/9012) | 账号密码这条路大概率已不可用；WebView 和粘贴 cookie 两条路仍可用【推断】 |
| S28 | 系统 WebView 版本太旧时，会在 Cloudflare 挑战上死循环 | 2025-12 至 2026-08 | [JHenTai #720](https://github.com/jiangtian616/JHenTai/issues/720)、[SXJ #2831](https://github.com/xiaojieonly/Ehviewer_CN_SXJ/issues/2831) | 同上 |
| S29 | `igneous` 的无效值有 `mystery`、`null`、`deleted`、`expired`；旧的 9 位形式已失效，新形式约 17 位，据称由「干净的 IP」访问里站时大约每月刷新一次 | 2024-11 至 2026-05 | [SXJ #1625](https://github.com/xiaojieonly/Ehviewer_CN_SXJ/issues/1625)、[#2587](https://github.com/xiaojieonly/Ehviewer_CN_SXJ/issues/2587)、[JHenTai eh_cookie_manager.dart](https://github.com/jiangtian616/JHenTai/blob/c1470866ef/lib/src/network/eh_cookie_manager.dart#L65-L70) | cookie jar 会存下任何 `Set-Cookie`，`igneous=mystery` 可能覆盖掉好的值（[`com/hippo/network/CookieRepository.java:153-158`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/network/CookieRepository.java#L153-L158)） |
| S30 | 新 cookie `iq`：花 GP「Unlock Quota」后得到的 24 小时专属配额 token，设在 e-hentai.org 上 | 2024-08 | [NekoInverter e830735341](https://github.com/EhViewer-NekoInverter/EhViewer/commit/e830735341) | 没有处理 |
| S31 | 其他见到的 cookie：`sp`（配置档）、`star`、`sk`、`hath_perks`（`q` 标志 = MPV）、`datatags`、`skipserver`、`yay`（EhPanda 在里站会删掉它）、`__utmp` | 2023 起 | [EhPanda CookieClient.swift](https://github.com/EhPanda-Team/EhPanda/blob/37b979965c/EhPanda/App/Tools/Clients/CookieClient.swift#L129-L152) | 只处理 `nw` |

限额、计费、封禁相关的变化（S19-S24）见[限额与风控](Limits-and-Anti-Crawling.md)。

## 3. 各家的登录做法

| 项目 | 账号密码 | 浏览器 / WebView | 导入 cookie | 里站检查 |
|---|---|---|---|---|
| JHenTai | 论坛 POST，`CookieDate=365`；2025-12 起被 Cloudflare 挡住 | 有；v8.0.11（2026-02）加了「WebView 辅助的 cookie 登录」 | 支持，解析 `ipb_member_id`、`ipb_pass_hash`、`igneous` | `igneous` 为空或是 `null` / `mystery` / `deleted` 时不切里站；可以一键刷新 `igneous` |
| EhPanda | 论坛 POST，字段多了 `b=d`、`bt=1-1`、`ipb_login_submit` | 有 | 每个主机一个 cookie 编辑器 | 有登录 cookie 但没有 `igneous` 时，直接 GET 一次 `exhentai.org` 来取 |
| gallery-dl | 被 Cloudflare 挡住，官方建议用 cookie | — | 推荐；支持 `cf_clearance` | 没有凭据时退回表站 |
| LANraragi | — | — | 插件参数：`ipb_member_id`、`ipb_pass_hash`，可选 `star`、`igneous`（说明里写：从欧美以外的 IP 看里站需要 `igneous`） | — |
| PandaProxy | Basic Auth：用户名 = member id，密码 = pass hash | — | 服务端注入这两个 cookie，剥掉客户端自己的 cookie、Referer、Authorization | 没有 `igneous` 逻辑 |

## 4. 先行实现：服务端 / 局域网组件

| 项目 | 做什么 | 登录 | 限额处理 | 状态 |
|---|---|---|---|---|
| [lifegpc/eh-downloader](https://github.com/lifegpc/eh-downloader) + [Flutter 前端](https://github.com/lifegpc/eh_downloader_flutter) | Deno 服务端，Docker 部署；有面板、Swagger API、用户与权限、任务队列（下载、导出 zip、导入）、缩略图、共享 token（[api.yml](https://github.com/lifegpc/eh-downloader/blob/be3f4189d0/api.yml)） | 配置里写一整串 cookie（`ipb_member_id; ipb_pass_hash; sk; sp`） | 同时 1 个任务、3 张图、重试 3 次、超时 10 s；收到 429 后 10 秒内不再请求 E-Hentai；有一个读 home.php 限额的 API | 最后提交 2025-03-09 |
| [LANraragi](https://github.com/Difegue/LANraragi) | 自托管漫画档案管理，有 E-Hentai 登录 / 元数据 / 下载插件 | 插件参数里的 cookie | 冷却默认 4 s；结果页出现 `You are opening` 时额外睡 15-50 s；遇到封禁直接中止；下载插件通过 archiver 花 GP | 活跃；在上述 DMCA 通知里被点名，但仍可读 |
| JHenTai「Archive Bot」 | 第三方「帮你解析归档」HTTP 服务（EH_ArBot、archive-at-home）：服务方持有账号和 GP，客户端只拿一个 API key | 服务方 | 服务方统一管理 GP 和余额 | 2025-04 起 |
| [moycat/PandaProxy](https://github.com/moycat/PandaProxy) | Go 写的里站反向代理，带 Basic Auth，会改写文本里的主机名 | 每个请求带凭据，代理转成 cookie | 无 | 2020 年后无更新 |
| 只服务已下载内容的局域网功能 | JHenTai [#804](https://github.com/jiangtian616/JHenTai/issues/804) / PR #811（可信局域网共享）；SXJ PR [#2727](https://github.com/xiaojieonly/Ehviewer_CN_SXJ/pull/2727)（局域网服务器模式）、#2754（NAS 同步） | — | — | 2026 |

各 issue 里都没有找到「homelab / 服务器单 IP 跑 E-Hentai 请求」的经验报告；最接近的是共享 IP 的警告（见[限额与风控](Limits-and-Anti-Crawling.md)）。
