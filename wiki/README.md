# EhServer 调查 wiki

EhServer 是 [HicirTech/Ehviewer-Lab#84（dispatcher 模式）](https://github.com/HicirTech/Ehviewer-Lab/issues/84)的服务端：把访问 E-Hentai 的事情（搜索、列表、详情、取图、下载调度）全部搬到 homelab 上的一台机器，手机只和这台机器说话。

本 wiki 是动工之前的调查，摸清 E-Hentai 本身：站点地图、登录、选址、阅读方式、爬虫限制。主要证据是 EhViewer（Ehviewer-Lab）的客户端代码，另外参考官方和社区资料。目前只有调查，没有代码。

## 页面

| 页面 | 内容 |
|---|---|
| [站点地图](Site-Map.md) | 主机、各类页面的 URL、列表搜索参数、翻页、外部链接 |
| [登录与会话](Login-and-Session.md) | 四种登录方式、cookie 清单、里站权限、账号设置、会话失效 |
| [选址与网络](Site-Selection-and-Network.md) | 表站 / 里站选择、DNS 链、内置 IP、DoH、域前置（SNI）、TLS、代理、请求头 |
| [API](API.md) | `api.php` 的 6 个方法：请求和响应 |
| [请求清单](Request-Inventory.md) | 客户端发出的全部请求、错误识别路径、线程与重试 |
| [阅读方式](Reading-Pipeline.md) | ptoken → showkey → showpage → 图片的状态机、`nl` 重试、509、原图、`.ehviewer` 格式 |
| [下载、归档与种子](Download-Archive-Torrent.md) | 逐页下载调度、Archiver（花 GP）、H@H 归档、种子 |
| [限额与风控](Limits-and-Anti-Crawling.md) | 图片限额（按 IP / 按账号）、计费、GP 规则、封禁、各客户端的节奏控制 |
| [解析器与数据模型](Parsers-and-Data-Model.md) | 22 个解析器、显示设置对页面的影响、数据模型、编码、最脆弱的 10 处、改版时间线 |
| [功能面](Feature-Surface.md) | 哪些功能访问 E-Hentai、哪些只在本地、E-Hentai 之外的数据源、相关设置项 |
| [其他客户端与先行实现](Prior-Art.md) | 其他开源客户端的做法、它们反映的站点变迁、已有的服务端类项目、DMCA 现状 |
| [对 EhServer 的含义](EhServer-Implications.md) | **唯一的分析页**：把上面的事实对应到 #84 的七个问题，以及建议的 spike |
| [来源与核验](Sources-and-Verification.md) | 证据来源、核验方法、已知缺口 |

## 关键事实

- **两个站，一个账号**：表站 `e-hentai.org`，里站 `exhentai.org`。`home.php`、`toplist.php`、`news.php`、论坛、缩略图不管选哪个站都在 e-hentai.org / ehgt.org 上。[站点地图](Site-Map.md)
- **登录就是 cookie**：`ipb_member_id` + `ipb_pass_hash`，里站还要 `igneous`。论坛自 2025-12 起有 Cloudflare 挑战，脚本登录会返回 403。[登录与会话](Login-and-Session.md)
- **读一页图要多步**：先从详情页的预览图拿到这一页的 ptoken，第一次用单页 HTML 换出 showkey，之后每页一次 `showpage` API 换出图片 URL；失败时用 `nl` 换图片服务器，每页最多 5 轮。[阅读方式](Reading-Pipeline.md)
- **图片限额默认按 IP 计**：只有 Bronze Star（捐 20 美元）或 More Pages perk（200 Hath）的账号按账号计，10,000 张起；花 20,000 GP 能买 24 小时、10,000 张的临时账号配额；开着 H@H 时到限额不出 509，而是降到 1280x。[限额与风控](Limits-and-Anti-Crawling.md)
- **页面加载过快会先警告、后封 IP**：封禁页是纯文本，带剩余时间；阈值和时长不公开。官方给的 API 节奏是连续 4-5 次后等约 5 秒。[限额与风控](Limits-and-Anti-Crawling.md)
- **一人一号**：每人只允许一个活跃账号，账号共享按多开处理会被封号。[限额与风控](Limits-and-Anti-Crawling.md)
- **站点经常改版**：2023-10 到 2025-11，上游 EhViewer 分支为此修改了约 10 次解析器。[解析器与数据模型](Parsers-and-Data-Model.md)
- **法律环境在收紧**：2026-03 的一份 DMCA 通知让 GitHub 封了多个 E-Hentai 客户端仓库。[其他客户端与先行实现](Prior-Art.md)

## 标注约定

| 标注 | 含义 |
|---|---|
| 【代码】 | 在 Ehviewer-Lab 源码里看到的，附「文件:行号」 |
| 【夹具】 | Ehviewer-Lab 测试里保存的真实页面 |
| 【官方】 | EHWiki 或站点管理员的公告 |
| 【官方转引】 | 第三方转引的官方公告 |
| 【社区】 | 第三方客户端、工具或用户的资料 |
| 【推断】 | 基于上述事实的推理 |
| 【未知】 | 现有资料回答不了，需要实测 |

代码引用都指 [Ehviewer-Lab `16e019db`](https://github.com/HicirTech/Ehviewer-Lab/tree/16e019db1b4572a6474bede5d140106d38b5021b)，路径默认相对 `app/src/main/java/com/hippo/ehviewer/`，链接固定在这个提交上。客户端说明的是「客户端期望站点怎样」，不等于「站点一定怎样」。
