# 来源与核验

本页说明 wiki 里的事实从哪来、怎么核对过、还缺什么。调查时间：2026-10-10。

## 1. 证据来源

### 客户端代码【代码】

- [Ehviewer-Lab `16e019db`](https://github.com/HicirTech/Ehviewer-Lab/tree/16e019db1b4572a6474bede5d140106d38b5021b)，一个基于 [xiaojieonly/Ehviewer_CN_SXJ](https://github.com/xiaojieonly/Ehviewer_CN_SXJ) 2.0.2.5 的 EhViewer 分支。
- 关键依赖：OkHttp 3.14.7、Jsoup 1.15.4，targetSdk 35（[`app/build.gradle:32`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/build.gradle#L32)）。
- 阅读范围：`client/` 全部、`spider/`、`download/`、`ui/scene/sign/`、`EhApplication.java`、`Settings.java`、`res/xml/`、相关的测试和夹具。

### 保存的真实页面【夹具】

位于 `app/src/test/resources/com/hippo/ehviewer/client/parser/`，共 33 个，只有 13 个被测试引用。按内容可推出的抓取时间：

| 夹具 | 内容 | 时间 |
|---|---|---|
| `GalleryListParserTest*.html` | 两站各 5 种显示模式的列表页 | 2019-04 |
| `GalleryListParserNew3.html` | 游标翻页的列表页 | 2022-11 之后 |
| `FavoritesListParser.html` | 收藏页（游标翻页） | 2024-09 |
| `GalleryDetail.html` | 详情页（`gt200` 预览） | 2024-10 |
| `EhUconfig.html` | uconfig 页（带配置档） | 2023-12 |
| `MyHomePage.html`、`HomePageNew.html`、`Home.html` | home.php 的三种限额写法 | 2023-10、2024-08、2025-06 |
| `GalleryPageParserTest.html`、`GalleryPageApiParserTest.json` | 单页和 `showpage` 响应 | 2019 |
| `torrentList.html` | 种子列表（唯一确定是原始字节的） | 2026-04 |

部分夹具含有 `apikey`、EHTracker 个人 key、论坛登出 key 这类账号相关的值；本 wiki 不引用这些值。

### 官方【官方】

EHWiki（2026-10 读取）：[My Home](https://ehwiki.org/wiki/My_Home)、[API](https://ehwiki.org/wiki/API)、[Hath Perks](https://ehwiki.org/wiki/Hath_Perks)、[Donation](https://ehwiki.org/wiki/Donation)、[Archives](https://ehwiki.org/wiki/Archives)、[Hentai@Home](https://ehwiki.org/wiki/Hentai@Home)、[Technical Issues](https://ehwiki.org/wiki/Technical_Issues)、[Downloading](https://ehwiki.org/wiki/Downloading)、[Galleries](https://ehwiki.org/wiki/Galleries)、[E-Hentai Galleries FAQ](https://ehwiki.org/wiki/E-Hentai_Galleries_FAQ)、[FAQ](https://ehwiki.org/wiki/FAQ)、[Bans](https://ehwiki.org/wiki/Bans)、[Gallery Points](https://ehwiki.org/wiki/Gallery_Points)、[Gallery Point Exchange](https://ehwiki.org/wiki/Gallery_Point_Exchange)、[Multi-Page Viewer](https://ehwiki.org/wiki/Multi-Page_Viewer)。另读了服务条款 `e-hentai.org/tos.php`。

论坛 `forums.e-hentai.org` 被 Cloudflare 挡住，读不到原帖。2024-08-26 的限额改版公告只能读到第三方转引的版本（[JHenTai #503](https://github.com/jiangtian616/JHenTai/issues/503)），标为【官方转引】。

### 社区【社区】

主要来源：JHenTai、EhViewer-NekoInverter、EhPanda、Ehviewer_CN_SXJ 的代码和 issue，gallery-dl 的文档和 issue，LANraragi、eh-downloader、ccloli/E-Hentai-Downloader（含其限额 wiki）、PandaProxy，以及 GitHub 上公开的 DMCA 通知。每条都在[其他客户端与先行实现](Prior-Art.md)和[限额与风控](Limits-and-Anti-Crawling.md)里附了链接和日期。

## 2. 核验方法

- **代码引用**：每一处「文件:行号」都用脚本对照 `16e019db` 检查过文件存在、行号在范围内，并逐条人工比对引用行的内容和正文说法。引用链接固定在这个提交上。
- **关键代码结论回到源码重读**，包括：`EhEngine` 的方法数和错误判定顺序、`nw=1` 注入、请求头、`gdata` 每批 25 个、「Key mismatch」分支走不到、DNS 解析链和内置 IP 表、域前置的 VPN 判断方向、不发 SNI 的 socket 工厂、三种登录的 cookie 落点、退出登录的范围、home.php 的两版正则和 "IP-based limits" 标签、三份 home.php 夹具的原文、列表的游标翻页和 `ufirst` 大小写、解析器的改版历史、下载同时只跑一本、线程数默认值、明文流量配置、标签名不编码。
- **关键外部结论重新取原文核对**：DMCA 通知的点名名单；JHenTai #503 转引的 2024-08-26 公告；JHenTai #712（论坛 Cloudflare）；ccloli 限额 wiki（作者注明是自测）；EhPanda 的封禁页夹具；EHWiki 的 My Home、API、Hath Perks、Donation、Archives、Hentai@Home、Technical Issues、Galleries FAQ；服务条款；gallery-dl 的配置文档；NekoInverter 的 1 秒间隔提交；LANraragi #395。
- **核对中修正过的说法**：
  - #84 里写的「36 个 public static 方法」，实际是 33 个方法加 3 个静态字段；
  - 「23 个 parser」实际是 22 个解析器加 `ParserUtils`；
  - NekoInverter 的 1 秒间隔只在单本画廊内生效，不是全局的；
  - EHWiki 没有给出 H@H 下载器的费率，所以不写；
  - LANraragi 的封禁案例补全为 3、4、10 秒都出现过；
  - 「下载管理器 4 线程以内」只针对归档下载。

## 3. 已知缺口

- **没有抓真实流量**：单页、`showpage`、图片 URL、列表的实际形状，全部来自夹具（最早 2019 年）和其他客户端的资料。
- **论坛原帖读不到**：Cloudflare 挡住了，没有尝试绕过。
- **读不到的仓库**：FooIbar/EhViewer、Ehviewer-Overhauled（HTTP 451），gallery-dl 的 E-Hentai 提取器源码（已从 GitHub 移除）。
- **官方没有公开的**：按 IP 计的配额大小、降级和封禁的阈值与时长、重置费用公式、`igneous` 和里站的任何规则。
- 各页末尾的「未知」列出了具体问题：[限额与风控](Limits-and-Anti-Crawling.md)、[解析器与数据模型](Parsers-and-Data-Model.md)，以及[对 EhServer 的含义](EhServer-Implications.md)里的 spike 列表。
