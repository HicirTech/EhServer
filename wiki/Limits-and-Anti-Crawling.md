# 限额与风控

本页回答：E-Hentai 用什么手段限制访问量（图片限额、GP 计费、页面加载过快的预警和封禁、反爬降级、Cloudflare），按什么维度计，有哪些明文规则，客户端怎么应对。

来源标注：【官方】EHWiki 页面（2026-10 读取）；【官方转引】第三方转引的站点公告；【夹具】Ehviewer-Lab 测试里保存的真实页面；【代码】Ehviewer-Lab `16e019db`，路径相对 `app/src/main/java/com/hippo/ehviewer/`；【社区】第三方客户端 / 用户；【推断】；【未知】。

## 结论

- **图片限额默认按 IP 计**。捐赠 Bronze Star 及以上，或者买了 "More Pages" Hath perk（200 Hath），限额改为跟账号走。没有这两样的账号，可以花 20,000 GP 买一份 24 小时、10,000 张的账号配额，但它依赖 cookie，清掉就退回按 IP 计。【官方】
- **到达限额时**：开着 H@H 浏览，不会出 509，而是被强制降到 1280x 重采样图；关掉 H@H 才出 509。下载原图时自动扣 GP，没有 GP 就失败。【官方转引，2024-08-26】
- **页面加载过快有两级**：先是「你打开页面太快」的警告，再不收敛就临时封 IP。阈值和时长都不公开，社区见过从不到 1 小时到 3 天不等，重复触发会变长。封禁对这个 IP 后面的所有人生效。【官方 + 社区】
- **反爬降级**：被滥用的 VPN / 代理 IP 会被锁在 1280x 或 1920x，捐赠者不受影响。【官方】
- **官方给出的节奏**：API 每次最多 25 项，连续 4-5 次后等约 5 秒；以图搜图两次之间等 10 秒；归档每台服务器最多 5 路并发。【官方】
- **账号规则**：每人只允许一个活跃账号，账号共享按「多开」处理，会被封号。【官方】
- **Ehviewer-Lab 几乎不处理这些**：不识别封禁和警告，不限速，509 只让当前这一页失败，认不出 2024-08 之后的 home.php。【代码】

## 1. 图片限额

### 规则（官方）

| 项 | 内容 | 来源 |
|---|---|---|
| 计量维度 | 默认按 IP；Bronze Star 及以上，或 More Pages perk，改为按账号 | [EHWiki My Home](https://ehwiki.org/wiki/My_Home) |
| 临时账号配额 | 非捐赠者花 20,000 GP 买 24 小时、10,000 张的账号配额，照常恢复和消耗；清掉 cookie 就退回按 IP | 同上 |
| 恢复速度 | 通常每分钟 3-5 点，随服务器负载变化 | 同上 |
| 重置 | 花 GP 重置；GP 不够时自动按当日高价把 credits 换成 GP。公式不公开 | 同上、[Gallery Points](https://ehwiki.org/wiki/Gallery_Points) |
| 计费：`nl` 强制重载 | 每次 50 点（2023-09 之前是 5 点） | My Home |
| 计费：下载原图 | 每 MB 10 点 | My Home |
| 计费：关闭 H@H 的捐赠者 | 每个 API 请求 5 点，而不是 1 点，即使命中缓存或失败也照扣 | My Home |
| MPV | 没有单独计价，但它会预加载，耗得更快 | My Home |
| 非 H@H 提供的图片 | 限额更严 | [Galleries FAQ](https://ehwiki.org/wiki/E-Hentai_Galleries_FAQ) |
| 默认图片尺寸 | Auto，一般是 1280 宽（手机上 780）；发布超过一年的画廊不再生成 2560 重采样，改用 1920 | My Home |

### 配额大小（官方）

| 账号 | 计量 | 大小 |
|---|---|---|
| 未登录 / 非捐赠且没有 More Pages | IP | 2024-08 起不公布。旧版 EHWiki 写「通常 3,000-5,000」（2025-09 删掉了） |
| 买了临时配额 | cookie token，24 小时 | 10,000 |
| More Pages（200 Hath），或 Bronze Star（含 More Pages） | 账号 | 10,000 |
| Lots of Pages（500 Hath），或 Silver（含 Lots of Pages） | 账号【推断：页面没写明】 | 25,000 |
| Too Many Pages（1,000 Hath），或 Gold 及以上（含 Too Many Pages） | 账号【推断：页面没写明】 | 50,000 |

来源：[Hath Perks](https://ehwiki.org/wiki/Hath_Perks)、[Donation](https://ehwiki.org/wiki/Donation)。

### 2024-08-26 改版（官方转引）

来源：[JHenTai #503](https://github.com/jiangtian616/JHenTai/issues/503) 转引的论坛站点更新日志（topic 244935）。论坛本身现在被 Cloudflare 挡着，读不到原帖。

| 规则 | 内容 |
|---|---|
| 改版原因 | IP 共享越来越多（运营商级 NAT、VPN） |
| 三种模式 | 捐赠者和 More Pages 持有者按账号计；其他人默认按 IP 计；没有账号配额的人花 GP 重置，得到一份绑在 cookie token 上的 24 小时专属配额，同 IP 的其他人用不到 |
| 浏览时到限额 | 开 H@H：不出 509，强制降到 1280x；关 H@H：仍出 509 页 |
| 下载原图时到限额 | 后台自动扣 GP；没有 GP 就失败 |
| 首页 | 按 IP 计的配额不再显示数字；IP 被禁止看高分辨率图时，首页会写出来 |
| 归档 | 发布一年内的画廊可以用配额下归档（之前是 30 天） |
| 提醒 | 用量过大仍可能触发 DDoS 防护 |

### home.php 的三份快照（夹具）

| 抓取时间（提交日期） | 夹具 | Image Limits 区块的写法 |
|---|---|---|
| 2023-10-16 | `MyHomePage.html` | 「当前 4672，上限 5000」，重置费用 9344 GP |
| 2024-08-27 | `HomePageNew.html` | 「当前 538，**账号**上限 50,000」；花 1,076 GP 重置 |
| 2025-06-29 | `Home.html` | 「因请求频率高，你的 **IP** 目前被限制为只能看低分辨率图」；绑定账号需要 Bronze Star 或 More Pages；或者花 20,000 GP 解锁 24 小时 |

夹具位于 `app/src/test/resources/com/hippo/ehviewer/client/parser/`，里面含有个人 tracker key，引用时不要带出原值。

### 社区补充

- 表站、Lofi 和里站共用一个限额池。【社区：[ccloli wiki](https://github.com/ccloli/E-Hentai-Downloader/wiki/E%E2%88%92Hentai-Image-Viewing-Limits)】
- 按尺寸计费：Auto / 780x / 980x / 1280x 每页 1 点，1600x 3 点，2400x 5 点；不经 H@H 加载约 +50 点。真正计费的是取单页（`/s/…`）或原图跳转这一步，从 H@H 取图片文件本身不计费。【社区自测，ccloli wiki，2024-09】
- 2024-11：有用户在 IP 限额用完后换了 IP，工具仍显示已用完（[gallery-dl #6504](https://github.com/mikf/gallery-dl/issues/6504)）。【社区】

## 2. 原图与归档的 GP 规则

| 时间 | 规则 | 来源 |
|---|---|---|
| 2022-06-06 | 高峰时段下载原图要花 GP，限额用完时也要 | 【官方转引】ccloli wiki |
| 2022-08-07 | 高峰时段：周一至周六 UTC 14:00-20:00，周日 UTC 05:00-20:00 | 同上；也见 [EHWiki Downloading](https://ehwiki.org/wiki/Downloading) |
| 2022-11-25 | 新画廊免 GP 的期限从 30 天延长到 90 天；捐赠者不受此限 | 同上 |
| 2023-07-07 | 超过一年的画廊，下原图总要 GP；3-12 个月的，非高峰时段可以用配额；3 个月内的随时可以用配额 | 同上 |
| 2023-07-11 | 归档、原图、重置一律收 GP，credits 自动兑换 | 同上 |

归档的计费见[下载、归档与种子](Download-Archive-Torrent.md)。

## 3. 页面加载过快：警告与封禁

| 阶段 | 内容 | 来源 |
|---|---|---|
| 警告 | 「你打开页面太快」，再不放慢 IP 会被自动封禁。Chrome 预加载、自动刷新页面的插件和脚本都可能触发 | 【官方】[Technical Issues](https://ehwiki.org/wiki/Technical_Issues) |
| 封禁 | 以 `Your IP address has been temporarily banned for excessive pageloads` 开头。原因：一次打开太多页，或者下载软件同时拉太多图，或者同一 IP 上的别人这么做了。只能等它过期 | 同上 |
| 新版文字 | 后半句是「这可能说明你在用自动镜像 / 抓取软件，或者与这样做的人共用 IP」，结尾以 `The ban expires in` 开头，跟一个相对时间 | 【社区】[gallery-dl #5845](https://github.com/mikf/gallery-dl/issues/5845)（2024-07）、[EhPanda 夹具](https://github.com/EhPanda-Team/EhPanda/blob/37b979965c/EhPandaTests/Resources/Parser/Other/IPBanned.html) |
| 格式 | 纯文本，没有 HTML；可能出现在任何请求的响应里，包括本该返回图片字节的请求 | 【社区】同上 |
| 共用 IP 的补救 | 捐赠 20 美元后，账号不再受「同 IP 其他人引起的限制」影响 | 【官方】Technical Issues |
| 捐赠者自己 | 有 Gold Star 的账号也被封过，捐赠不豁免自身行为 | 【社区】pandachaika #17（2022-05） |
| 连接被中断 | 「页面加载时连接被取消」是连接数过多导致的自动封锁，要等它过期 | 【官方】Technical Issues |

### 见过的封禁时长（社区，零散）

| 时间 | 页面上显示的剩余时间 | 来源 |
|---|---|---|
| 2019-05 | 约 24 小时；有人说封了两天 | EhViewer #604、E-Hentai-Downloader #133 |
| 2021-02 | 2 天 16 小时 | E-Hentai-Downloader #178 |
| 2021-06 | 53 分钟（每分钟约 40 个请求、跑了约 3.5 小时之后）；24 小时；3 天 | E-Hentai-Downloader #133 |
| 2021-08 | 2 天 15 小时（间隔 1 秒时）；间隔调到 1.5 秒后没再封 | E-Hentai-Downloader #191 |
| 2023-06 至 2023-10 | 1 小时 51 分；第二次封了 3 天 | ehentai-qt #70、#77 |
| 2024-07、2025-09 | 「1 days」 | gallery-dl #5845、cyberdrop-dl #1309 |

有人回忆说第一次约 10 分钟，然后 1 小时，然后 1 天，重复触发会变长（ccloli，2021，凭记忆）。【社区】

### 触发案例（社区）

- 下一本 900 页的画廊，在约 200 页时被封，即使降了并发、换了代理节点（[JHenTai #324](https://github.com/jiangtian616/JHenTai/issues/324)）。
- 以每秒 2 张同时下多本画廊被封（[JHenTai #247](https://github.com/jiangtian616/JHenTai/issues/247)）。
- LANraragi：3 秒间隔偶尔被封；4 秒间隔给 1 万本归档打标签时被封（可能共用 IP）；10 秒间隔、每天约 500 本，也被封过一次；20 秒间隔、每天约 500 本没有被封。讨论的结论是总量比间隔更关键，没有确认过「安全间隔」（[LANraragi #395](https://github.com/Difegue/LANraragi/issues/395)，2021-02）。
- 有用户因为连续打开很多预览页被封了 10 分钟；JHenTai 维护者说该 app 不会导致**账号**被封（[JHenTai #574](https://github.com/jiangtian616/JHenTai/issues/574)，2025-02）。
- JHenTai 维护者认为封禁和图片限额无关，只有短时间内的异常请求量才会封 IP（[JHenTai #195](https://github.com/jiangtian616/JHenTai/issues/195)，2023-05）。
- 对 `api.e-hentai.org` 请求过快时，可能收到空的 200 响应（软限流）（Ehentai_metadata #15，2024-05）。

## 4. 其他防护

- **反爬降级**：图片尺寸被锁在 1280x 或 1920x，通常是因为用了被滥用的 VPN / 代理节点。换 IP 可以解决，捐赠者不受影响。【官方，Technical Issues】
- **Cloudflare**：论坛 `forums.e-hentai.org` 自 2025-12 起有 Cloudflare 挑战，普通请求返回 403（研究时也直接观察到，2026-10）。2023-07 到 2023-08，主站点也出现过一段时间（[gallery-dl #4342](https://github.com/mikf/gallery-dl/issues/4342)）。【社区 + 观察】
- **其他客户端识别的错误文字**（匹配前缀）：`You have exceeded your image`、`You have reached the image limit`（限额用尽且 GP 不足）、`Invalid token`、`Invalid request`、`An error has occurred`、`Backend fetch failed`、`Gallery Not Available - `、`Page load has been aborted due to a fatal error`、`Insufficient funds.`（重置时 GP 不足）。【社区：[JHenTai](https://github.com/jiangtian616/JHenTai/blob/c1470866ef/lib/src/service/gallery_download/eh_image_exception_matcher.dart#L8-L30)、[NekoInverter](https://github.com/EhViewer-NekoInverter/EhViewer/blob/634b281c69/app/src/main/java/com/hippo/ehviewer/client/EhEngine.kt#L81-L125)】
- **509 图片的 URL**：`ehgt.org/g/509.gif`（表站）、`exhentai.org/img/509.gif`（里站）。JHenTai 早先用「包含」匹配有误报，2024-03 改为精确匹配。【社区】

## 5. 明文规则

| 规则 | 来源 |
|---|---|
| 官方给出的 API 节奏：每次最多 25 项；连续 4-5 次通常没问题，之后等约 5 秒 | 【官方】[API](https://ehwiki.org/wiki/API) |
| 以图搜图：两次之间等 10 秒 | 【官方】Technical Issues |
| 归档：每台服务器最多 5 路同时下载 | 【官方】[Archives](https://ehwiki.org/wiki/Archives) |
| 手动下载没有限制，但下得太猛会触发 IP 封禁 | 【官方】[Downloading](https://ehwiki.org/wiki/Downloading) |
| 每人只允许一个活跃账号；账号共享按多开处理，会被封号 | 【官方】Technical Issues、[Bans](https://ehwiki.org/wiki/Bans) |
| GP 交易所禁止一切机器人 | 【官方】[Gallery Point Exchange](https://ehwiki.org/wiki/Gallery_Point_Exchange) |
| 没有官方 app 或插件；不鼓励使用会拦截登录的第三方工具 | 【官方】[FAQ](https://ehwiki.org/wiki/FAQ) |
| 官方提供的批量渠道：RSS（最新 100 本）、sitemap、OpenSearch；整本获取用归档、H@H 下载器、种子 | 【官方】[Galleries](https://ehwiki.org/wiki/Galleries)、Archives |
| 服务条款（`e-hentai.org/tos.php`）里**没有**关于自动访问、抓取或账号共享的条款，只说用户可以「通过服务提供的功能」访问内容 | 【官方】服务条款，2026-10 读取 |

## 6. 各客户端的节奏控制

| 项目 | 并发 / 间隔 | 遇到限制时 |
|---|---|---|
| gallery-dl | 请求间隔随机 3-6 秒（`sleep-request` 默认 `"3.0-6.0"`）；每张图失败重试 2 次 | `limits-action`：`stop`、`wait` 或 `reset`（花 GP 重置）；GP 不足时由 `gp` 选项决定继续下非原图、停止还是等待 |
| NekoInverter | 3 个线程；同一本画廊的所有线程共用一把锁，每个页面请求的发起间隔 1 秒（2023-10-12 起默认 1000 ms，[2667d636ec](https://github.com/EhViewer-NekoInverter/EhViewer/commit/2667d636ec)，提交说明是「缓解请求洪水」）；下载超时 60 秒 | 识别配额用尽；空响应体在表站当作 IP 封禁，在里站当作 Sad Panda |
| JHenTai | 下载并发 6，每秒最多启动 2 个；默认一次只下一本 | 识别封禁文字后默认**暂停全部任务**；E-Hentai 主机返回 403 时当作 Cloudflare 挑战 |
| LANraragi | 冷却默认 4 秒；看到「打开页面太快」的警告后额外睡 15-50 秒 | 遇到 `Your IP address has been` 就中止 |
| pandachaika | API 并发 4、间隔 5.5 秒；维护者说 API 默认间隔 6 秒，搜索 10 秒 | — |
| eh-downloader | 1 个任务、每个任务 3 张图、重试 3 次 | 收到 HTTP 429 后，10 秒内不再请求 E-Hentai |
| **Ehviewer-Lab** | 每本画廊 3 个线程（默认）；`download_delay` 默认 0 且没有设置界面 | 只识别 509 的 URL；不识别封禁、警告、429 |

来源见[其他客户端与先行实现](Prior-Art.md)；gallery-dl 的默认值读自其[配置文档](https://gdl-org.github.io/docs/configuration.html)。

## 7. Ehviewer-Lab 的处理

| 项 | 行为 | 证据 |
|---|---|---|
| 读限额 | `GET https://e-hentai.org/home.php`，先试新版正则（账号上限），再试旧版；两个都不匹配就显示 "IP-based limits" | [`client/parser/EhHomeParser.java:20-21`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/EhHomeParser.java#L20-L21)、[`client/data/HomeDetail.java:91-96`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/data/HomeDetail.java#L91-L96) |
| 重置 | `POST home.php`，表单 `reset_imagelimit=Reset Limit`。2024-08 的页面上这个按钮的值是 `Reset Quota`；NekoInverter 现在发 `Reset Quota` 或 `Unlock Quota` | [`client/EhEngine.java:1437-1440`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L1437-L1440) |
| `iq` cookie | 不处理 | — |
| 509 | 图片 URL 以 `/509.gif` 或 `/509s.gif` 结尾；当前这一页失败，其他线程继续 | [`spider/SpiderQueen.java:116-119`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L116-L119) |
| 原图没有 GP | 拿不到 302 的 `Location` 就报 "GP不足"；分不清是高峰扣费、限额用尽、封禁还是临时错误 | [`spider/SpiderQueen.java:1405-1419`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L1405-L1419) |
| 封禁 / 警告文字 | 不识别。纯文本响应体如果走到解析失败的分支，会被原样显示给用户；在图片下载阶段，只会被「内容全是文本」的检查拦下，然后换 `nl` 重试（每次 50 点），原因丢失 | [`client/EhEngine.java:135-137`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L135-L137)、[`spider/SpiderQueen.java:1564-1582`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L1564-L1582) |
| 429 / `Retry-After` | 不处理 | — |
| `igneous` 被覆盖 | 服务器发来的任何 `Set-Cookie` 都会存下，`igneous=mystery` 能盖掉有效值 | [`com/hippo/network/CookieRepository.java:153-158`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/network/CookieRepository.java#L153-L158) |

## 8. 互相矛盾的资料

| 话题 | 说法 A | 说法 B |
|---|---|---|
| 到限额的表现 | Technical Issues 的 509 条目：按 IP 计（捐赠者除外），表现是 509（这段文字自 2018 年基本没改） | 2024-08 公告和 My Home（2025-09 起）：三种模式；开 H@H 时降到 1280x 而不是 509 |
| 恢复速度 | EHWiki：每分钟 3-5 点 | ccloli：每分钟约 9 点（时间不详） |
| 原图计费 | My Home：每 MB 10 点 | Galleries 页的提示：每 MB 5 点（旧） |
| `nl` 的含义 | EHWiki：换一个 H@H 节点重新取 | 客户端和 ccloli：跳过 H@H，从源服务器取。两边都说每次 50 点 |
| 归档并发 | FAQ：最多 4 路 | Archives：每台服务器最多 5 路 |
| 里站 API 主机 | `exhentai.org/api.php`、`s.exhentai.org/api.php` 等多种写法，见 [API](API.md) | |

## 9. 未知

- 按 IP 计的配额现在是多少（2024-08 起不公布）。
- 「请求频率高」「页面打开太快」的阈值、时间窗口、封禁时长的规则。
- 按账号计限额的用户，会不会同样因为请求频率被降级。
- 封禁只看 IP，还是也看账号或 cookie；一个 IP 上同时有多个账号会不会被当成多开。
- `igneous` 签发后是否和 IP 绑定（社区说法矛盾）。
- 归档是否消耗图片配额。Downloading 页只把「手动下载」列为计入浏览限额，归档没列，所以推断不计入；但 2024-08 公告又说可以「用配额下归档」。
- 未登录访客和登录用户的配额有没有区别。
