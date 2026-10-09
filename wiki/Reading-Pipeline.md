# 阅读方式

本页回答：客户端从「点开一本画廊」到「拿到图片字节」，中间发了哪些请求、靠什么状态把它们串起来。

代码引用指 Ehviewer-Lab `16e019db`，路径相对 `app/src/main/java/com/hippo/ehviewer/`。`i` 是从 0 开始的页序号，URL 里的页码是 `i+1`。

## 结论

- 读一页图要两步：先拿到这一页的 **ptoken**（来自详情页的预览缩略图链接），再用 ptoken 换出**图片 URL**（第一次走单页 HTML，之后走 `showpage` API）。最后去图片 URL 下载字节。【代码】
- 串起这些请求的是三样状态：`ptoken` 表（可持久化）、`showkey`（每本画廊一个，只在内存）、`nl` 跳过 key（每页、每次尝试都不同）。【代码】
- 读完 N 页大约要发 `ceil(N/每页预览数) + 2N` 个请求。开了「下载原图」再加 N 个。【推断，按代码数出来的】
- 客户端**不支持** MPV（多页浏览器 / `imagedispatch`）。【代码】
- 遇到 509 只把这一页标成失败，不退避、不暂停，其他线程继续跑。【代码】

## 1. 入口

- 阅读器 `GalleryActivity` 收到 `ACTION_EH` 后，用 `EhGalleryProvider`，后者调 `SpiderQueen.obtainSpiderQueen(ctx, info, MODE_READ)`（[`gallery/EhGalleryProvider.java:46-51`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/gallery/EhGalleryProvider.java#L46-L51)）。
- `SpiderQueen` 按 gid 复用实例（`sQueenMap`）。同一本画廊的阅读和下载共享一个实例：同一套工作线程，同一个 `showkey`（[`spider/SpiderQueen.java:197-214`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L197-L214)）。
- 如果某一页已经在本地缓存或下载目录里，就不发任何请求（[`spider/SpiderQueen.java:1680-1683`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L1680-L1683)）。

## 2. 请求序列

| # | 线程 | 请求 | 头 | 期望的响应 | 何时发 |
|---|---|---|---|---|---|
| R1 | 主控 | `GET {host}g/{gid}/{token}/` | `Referer: {root}` | 详情 HTML：总页数、预览页数、预览缩略图链接 `/s/{10 位 hex}/{gid}-{页}` | 本地没有有效的 SpiderInfo 时，只发一次；失败了整个阅读结束 |
| R2 | 主控（串行） | `GET {host}g/{gid}/{token}/?p={k}` | 同上 | 同上 | 某页的 ptoken 不在表里时；`k = i / 每页预览数`；最多尝试 2 次 |
| R3 | 工作线程 | `GET {host}s/{ptoken}/{gid}-{i+1}`，可能带 `?nl=` | `Referer: {host}g/{gid}/{token}/` | 单页 HTML：`<img … src="…" style`、`nl('…')`、可选的 `fullimg` 链接、`var showkey="…";` | 还没有 showkey，或图片阶段失败、需要换主机时；同一本画廊同一时刻只允许一个这样的请求 |
| R4 | 工作线程 | `POST {host}api.php`，`showpage` | `Origin`；`Referer` = 上一页的单页 URL（`i>0` 时） | JSON：`i3`（图片）、`i6`（nl key 和原图链接）、`i7`（原图），或 `error` | 有 showkey 时的常规路径 |
| R5 | 工作线程 | `GET {原图链接}?nl=…`，图片 client，不跟随重定向 | `Referer` = 单页 URL | `302` 和 `Location` | 只在开了「下载原图」时 |
| R6 | 工作线程 | `GET {图片 URL}` | `Referer` = 单页 URL | 200 和图片字节 | 每页都发 |

证据：[`spider/SpiderQueen.java:892-956`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L892-L956)、[`spider/SpiderQueen.java:1284-1451`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L1284-L1451)、[`client/EhEngine.java:1203-1273`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L1203-L1273)。

## 3. ptoken：每页的钥匙

- 来源是详情页的预览缩略图。每个缩略图链接都要严格匹配 `https?://(?:exhentai.org|e-hentai.org|lofi.e-hentai.org)/s/([0-9a-f]{10})/(\d+)-(\d+)`（[`client/parser/GalleryPageUrlParser.java:30-31`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryPageUrlParser.java#L30-L31)）。也就是说，ptoken 是 10 位小写十六进制，链接必须是绝对地址。
- 每个预览页能提供「每页预览数」个 ptoken。这个数取决于账号的缩略图设置（行数、大小），客户端从第一页的数量推算出来（[`spider/SpiderQueen.java:869-890`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L869-L890)）。
- 补取是串行的：一本画廊只有一个主控线程处理 ptoken 请求队列（[`spider/SpiderQueen.java:1039-1085`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L1039-L1085)）。
- 工作线程取第 `i` 页时，会顺便要第 `i-1` 页的 ptoken。这个 ptoken 只用来给 R4 填 Referer，到了预览页的分界处可能因此多发一次 R2（[`spider/SpiderQueen.java:1698-1762`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L1698-L1762)）。
- 两次都取不到时，记一个哨兵值 `"failed"`，这一页报 "Get pToken error"。只有用户手动「强制重试」才会清掉它（[`spider/SpiderQueen.java:1067-1079`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L1067-L1079)、[`spider/SpiderQueen.java:1685-1696`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L1685-L1696)）。

## 4. showkey：每本画廊一把

- 每个 `SpiderQueen` 一个 `AtomicReference<String>`，所有工作线程共享，不持久化（[`spider/SpiderQueen.java:169`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L169)）。
- 只能从单页 HTML 里取到，正则是 `var showkey="([0-9a-z]+)";`（[`client/parser/GalleryPageParser.java:31`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryPageParser.java#L31)）。
- 取 showkey 的 HTML 请求放在 `showKeyLock` 里，所以同一本画廊的 HTML 请求是串行的；API 请求和图片请求不受这个锁限制。
- showkey 失效时，代码里有一个本该重新取 key 的分支，但实际走不到（见[请求清单 · 客户端完全不识别的](Request-Inventory.md)）。现在的实际行为是：这一页失败，错误信息是原始 JSON。【代码 + 推断】
- showkey 的作用范围（按画廊还是按页）和有效期，代码回答不了。【未知】

## 5. nl：换一台图片服务器再试

`SpiderWorker.downloadImage` 每页最多跑 5 轮（[`spider/SpiderQueen.java:1294`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L1294)）：

```
for 第 0..4 轮:
  if 没有 showkey 或 forceHtml:
      上一次的 nl key 为空或重复 → 结束（leak）
      GET 单页 HTML（URL 后面追加 nl=上一次的 key）
      取出 图片 URL、新的 nl key、原图链接、showkey
  if 还没有图片 URL:
      POST showpage
  下载图片（R5/R6）
  图片阶段任一失败 → forceHtml = true，进入下一轮
5 轮用完或 leak → 这一页失败
```

- nl key 的来源：HTML 里是 `onclick="return nl\('([^\)]+)'\)`（[`client/parser/GalleryPageParser.java:28`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryPageParser.java#L28)），API 里是 `i6` 字段，同一个正则。测试夹具里的值形如 `26664-430636`。
- 重试 URL 会不断叠加：第 2 轮是 `…?nl=K1`，第 3 轮是 `…?nl=K1&nl=K2`（[`spider/SpiderQueen.java:1240-1257`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L1240-L1257)）。服务器认哪一个，不知道。【代码 + 未知】
- 只有图片阶段的失败才会重试：状态码 ≥ 400、响应体为空、长度不足、文件内容全是文本、网络错误，以及下一节的「链接被劫持」。单页 HTML 出错、API 出错、509、原图失败都直接结束这一页。【代码】

## 6. 509、原图、劫持检查

| 情况 | 判定 | 反应 | 证据 |
|---|---|---|---|
| 图片限额用尽 | R3 / R4 拿到的图片 URL 以 `/509.gif` 或 `/509s.gif` 结尾 | 这一页报 "509"。下载时弹通知「Image limit has been reached」；阅读器里是个空的 TODO | [`spider/SpiderQueen.java:116-119`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L116-L119)、[`gallery/EhGalleryProvider.java:165-168`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/gallery/EhGalleryProvider.java#L165-L168) |
| 原图 | 单页里匹配 `<a href="([^"]+)fullimg([^"]+)">`；R5 读 `Location` | 拿不到 `Location` 就报 "GP不足/Insufficient GP"，不重试 | [`client/parser/GalleryPageParser.java:29`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryPageParser.java#L29)、[`spider/SpiderQueen.java:1405-1419`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L1405-L1419) |
| 链接疑似被劫持 | 下载完成后，最后一跳的 URL 和请求的图片 URL 不完全相等 | 置 `forceHtml`，换 nl 重试 | [`spider/SpiderQueen.java:1439-1451`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L1439-L1451) |

- 主 client 会跟随重定向，所以图片请求只要被重定向一次，就会被判成「劫持」。【推断】
- 「下载原图」默认关，开着时阅读模式也会走原图（[`Settings.java:910-919`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/Settings.java#L910-L919)）。设置界面的说明文字警告这样做容易触发 509。

## 7. SpiderInfo（`.ehviewer` 文件）

ASCII 文本，每行以 `\n` 结尾（[`spider/SpiderInfo.java:256-295`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderInfo.java#L256-L295)）：

| 行 | 内容 |
|---|---|
| 1 | `VERSION2` |
| 2 | 阅读进度 `startPage`，8 位十六进制 |
| 3 | gid |
| 4 | token |
| 5 | 常量 `1`（废弃的 mode 字段） |
| 6 | 预览页数 |
| 7 | 每页预览数 |
| 8 | 总页数，必须在 `0 < pages <= 100000` 之间 |
| 9… | 每个已知 ptoken 一行，格式 `<页序号> <ptoken>` |

存在下载目录里的 `.ehviewer`（目录已存在时才写），以及 `cacheDir/spider_info` 磁盘缓存（5 MB）。读取时下载目录优先（[`spider/SpiderQueen.java:817-850`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L817-L850)、[`spider/SpiderQueen.java:958-984`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L958-L984)）。

客户端把 ptoken 当作长期有效的数据，缓存并持久化；showkey 只放在内存里；nl key 每次现取。【代码】

## 8. 并发与节奏

| 项 | 值 | 证据 |
|---|---|---|
| 每本画廊的工作线程 | `download_thread`，限制在 1-10，默认 3；界面可选 1/3/5/7；阅读和下载共用这一个设置 | [`spider/SpiderQueen.java:182`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L182) |
| 预加载 | `preload_image`，限制在 0-100，默认 5 | [`spider/SpiderQueen.java:183`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L183) |
| 解码线程 | 2 | [`spider/SpiderQueen.java:106`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L106) |
| 每页成功后的间隔 | `download_delay` 毫秒，默认 0，**没有设置界面** | [`Settings.java:1390-1398`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/Settings.java#L1390-L1398) |
| 图片请求整体超时 | `download_timeout` 秒，默认 0（不限） | [`spider/SpiderQueen.java:193`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L193) |
| 连接 / 读超时 | 10 s | [`EhApplication.java:393-395`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/EhApplication.java#L393-L395) |

在客户端里，限制请求节奏的只有「线程数」和一个没有界面的 `download_delay`。【代码】

## 9. 没做的事

- **MPV / `imagedispatch`**：仓库里没有。`/mpv/` 只在链接解析里被识别成「画廊链接」（[`client/parser/GalleryDetailUrlParser.java:31-32`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryDetailUrlParser.java#L31-L32)）。MPV 只对 Gold Star 及以上或 Multi-Page Viewer perk 开放（【官方】[Multi-Page Viewer](https://ehwiki.org/wiki/Multi-Page_Viewer)）；它会预加载，消耗限额更快（【官方】My Home）。其他客户端说，账号的阅读器设置为 MPV 时，`/s/` 页面会变样，本 app 的单页解析会因此失败。【社区，见[其他客户端与先行实现](Prior-Art.md) S13】
- **图片尺寸（`xr`）**：设置里有，但没有任何请求带上它，实际效果由账号在网站上的设置决定。【代码】
- **429 / 退避**：没有。

## 10. 图片 URL 的样子

客户端把图片 URL 当作不透明字符串，不解析它的结构。仓库里能看到的样例都来自 2019 年的测试夹具：

| 形状 | 来源 |
|---|---|
| `http://<ipv4>:<port>/h/<sha1>-<字节数>-<宽>-<高>-<扩展名>/keystamp=<时间戳>-<hex>;fileindex=<n>;xres=<分辨率>/<文件名>` | [`app/src/test/java/com/hippo/ehviewer/client/parser/GalleryPageParserTest.java:42`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/test/java/com/hippo/ehviewer/client/parser/GalleryPageParserTest.java#L42) |
| `https://e-hentai.org/fullimg.php?gid=…&page=…&key=…` | 同上 |
| `https://e-hentai.org/r/<sha1>-…/forumtoken/<gid>-<page>/<文件名>` | API 夹具 `i6` |

- 夹具里的 H@H 地址是明文 `http://`。而 app 的网络安全配置只允许 `ehtracker.org` 走明文（[`res/xml/network_security_config.xml:25-27`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/res/xml/network_security_config.xml#L25-L27)），所以今天的真实图片 URL 必定不是这个样子。【推断】现在的实际形状要抓包确认。【未知】
- 社区资料里较新的形状：原图链接是 `/fullimg/<gid>/<page>/<key>/<文件名>`，302 跳到 `*.hath.network` 节点；预览图也在 `*.hath.network` 上，带有时效 token。【社区，见[其他客户端与先行实现](Prior-Art.md) S6、S12】
- H@H 图片 URL 的形状：`https://<label>.<label>.hath.network:<port>/h/<sha1>-<字节>-<宽>-<高>-<扩展名>/keystamp=<unix 时间>-<hash>;fileindex=<n>;xres=<分辨率>/<文件名>`，`keystamp` 在前后 15 分钟内有效。【社区：EhPanda 夹具（2023-09）、hath-rust 源码】
- 图片直链的有效期：经 H@H 加载的最多 15 分钟，直接从服务器加载的最多 24 小时。【官方：[Galleries FAQ](https://ehwiki.org/wiki/E-Hentai_Galleries_FAQ)】
- `nl` 重载每次计 50 点（2023-09 之前是 5 点），而这个循环每页最多跑 5 轮。【官方：[My Home](https://ehwiki.org/wiki/My_Home)】
- `nl` 到底做什么，说法不一：EHWiki 说它会换一个 H@H 节点重新取；客户端和 ccloli 说它跳过 H@H、从源服务器取。捐赠者还可以在单页 URL 后加 `?nl=1`，这一张图绕开 H@H 集群。【官方 + 社区】
- 单页 URL 里的 ptoken 是原图 SHA-1 的前 10 位十六进制。开了 `datatags` 后，缩略图上直接带有这个 SHA-1。【社区：JHenTai、NekoInverter】
- 2019 年的单页夹具里写的 API 地址是 `https://api.e-hentai.org/api.php`，而客户端始终请求 `{host}api.php`。
