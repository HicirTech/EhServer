# 下载、归档与种子

本页回答：客户端有哪几种「把一本画廊整本拿下来」的方式，各自发什么请求、怎么调度、要花什么。

代码引用指 Ehviewer-Lab `16e019db`，路径相对 `app/src/main/java/com/hippo/ehviewer/`。

## 结论

- 有三种拿法：**逐页下载**（和阅读同一条流水线，见[阅读方式](Reading-Pipeline.md)）、**归档下载**（Archiver，花 GP 买一个 zip）、**种子**（ehtracker.org）。还有一种「H@H 归档」：让账号绑定的 H@H 客户端去下载，客户端自己不拿字节。【代码】
- 逐页下载**同时只跑一本**，每本 3 个线程（默认）。【代码】
- 下载队列只在内存里，重启后不会自动恢复。【代码】
- 归档页的解析靠 DOM 下标，任何异常都被吞掉。页面一改版，对话框就会默默显示一片空白。【代码】

## 1. 逐页下载

### 调度

| 项 | 行为 | 证据 |
|---|---|---|
| 入口 | `CommonOperations.startDownload` → `DownloadService` → `DownloadManager.startDownload` | [`ui/CommonOperations.java:136-231`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/CommonOperations.java#L136-L231)、[`download/DownloadManager.java:350-422`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/download/DownloadManager.java#L350-L422) |
| 全局并发 | `DownloadManager` 同时只跑一本（注释原话 "Only one download"），其余在 `mWaitList` 排队 | [`download/DownloadManager.java:312-348`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/download/DownloadManager.java#L312-L348) |
| 每本并发 | `download_thread` 个工作线程，默认 3 | [`spider/SpiderQueen.java:182`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L182) |
| 顺序 | 用 `mDownloadPage++` 顺序领页；领之前先看本地有没有，阅读缓存里已有的页直接复制，不重新下载 | [`spider/SpiderQueen.java:1646-1658`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L1646-L1658)、[`spider/SpiderDen.java:396-401`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderDen.java#L396-L401) |
| 间隔 | 只有每页成功后 `sleep(download_delay)`，默认 0；一本下完立刻开始下一本 | [`spider/SpiderQueen.java:1604`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L1604)、[`download/DownloadManager.java:1314-1315`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/download/DownloadManager.java#L1314-L1315) |
| 失败 | 有页失败时整本记为 `STATE_FAILED`，`legacy = 总页数 - 已完成`；不自动重排，不退避 | [`download/DownloadManager.java:1273-1317`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/download/DownloadManager.java#L1273-L1317) |
| 持久化 | 表 `DOWNLOADS`：gid、token、标题、缩略图、分类、状态、标签等。每页完成与否看图片文件和 `.ehviewer` | [`dao/DownloadsDao.java:206-220`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/dao/DownloadsDao.java#L206-L220) |
| 重启 | 加载时把 `WAIT` / `DOWNLOAD` 状态重置为 `NONE`，**不自动恢复** | [`EhDB.java:436-441`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/EhDB.java#L436-L441) |
| 前台服务 | `DownloadService` 是 `START_STICKY` 前台服务（Android 14+ 用 `dataSync` 类型）；Android 15 的 `onTimeout` 到点时停止全部下载 | [`download/DownloadService.kt:146-162`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/download/DownloadService.kt#L146-L162) |
| 网络条件 | 没有「仅 Wi-Fi」或计费网络判断；没有 WorkManager / JobScheduler | — |

### 估算

一本 N 页、每个预览页 P 张缩略图，没有缓存、没有失败时：约 `ceil(N/P)` 个详情页请求，加 1 个单页 HTML，加 `N-1` 个 `showpage`，加 N 个图片请求。开了原图再加 N 个跳转请求。【推断，按代码数出来的】

以 40 页、每页 20 张预览为例：约 2 + 1 + 39 + 40 = 82 个请求。

## 2. 归档下载（Archiver，花 GP 或 credits）

前提是详情页里的 `apiuid ≥ 0`（已登录），否则提示先登录（[`ui/scene/gallery/detail/GalleryDetailScene.java:1548-1558`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/scene/gallery/detail/GalleryDetailScene.java#L1548-L1558)）。

1. 从详情页 HTML 里抓归档链接：`<a[^<>]*onclick="return popUp\('([^']+)'[^)]+\)">Archive Download</a>`（[`client/parser/GalleryDetailParser.java:73`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryDetailParser.java#L73)）。
2. `GET` 这个链接，`Referer` 设为详情页。`ArchiveParser.parseArchiver` 按 DOM 下标取余额、原图档和重采样档的价格、大小和表单 action。表站和里站的下标不同（[`client/parser/ArchiveParser.java:61-99`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/ArchiveParser.java#L61-L99)）。
3. 用户选「原图」或「重采样」后，`POST` 到表单 action：`dltype=org|res`、`dlcheck=Download Original Archive|Download Resample Archive`（[`client/EhEngine.java:944-964`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L944-L964)）。
4. 在响应体里找 `document.location = "(.*)"`，`GET` 那个地址，再从返回页里找 `href="(.*)">Click Here To Start Downloading`。最终下载地址是 `"https://" + 最后一跳的主机 + 路径`（[`client/EhEngine.java:978-995`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L978-L995)、[`client/parser/ArchiveParser.java:40`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/ArchiveParser.java#L40)）。
5. 下载 zip：裸 OkHttp 请求，断点续传时带 `Range: bytes=<偏移>-`。服务器返回 200 时说明不支持续传，从头再来。任务状态存在 SharedPreferences `archiver_cache` 里，应用启动时恢复（[`download/ArchiverDownloader.kt:95-104`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/download/ArchiverDownloader.kt#L95-L104)、[`download/ArchiverDownloader.kt:181-186`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/download/ArchiverDownloader.kt#L181-L186)）。
6. 下载完解压，按普通下载导入（[`download/ArchiverDownloadCompleter.kt:39-75`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/download/ArchiverDownloadCompleter.kt#L39-L75)）。

失败识别很弱：余额不足没有专门识别，找不到 `document.location` 就返回 null，界面只显示「失败」（[`ui/dialog/ArchiverDownloadDialog.java:173-176`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/dialog/ArchiverDownloadDialog.java#L173-L176)）。【代码】

### 官方规则（[EHWiki Archives](https://ehwiki.org/wiki/Archives)、[FAQ](https://ehwiki.org/wiki/E-Hentai_Galleries_FAQ)、[Donation](https://ehwiki.org/wiki/Donation)，2026-10 读取）

| 项 | 规则 |
|---|---|
| 价格 | 每 MiB 20 GP，按所选文件的大小计；捐赠者每 MiB 15 GP |
| 「重建」加价 | 画廊发布超过 365 天，且最近 90 天没有别人下载过时，价格 ×3 |
| 付款 | 2023-07-11 起一律收 GP，GP 不够时自动兑换 credits；不退款 |
| 链接有效期 | 一周，到期自动失效；一周内重复下载免费 |
| 链接的 IP 限制 | 同一个链接最多被两个 /24 网段使用，超过就要等链接过期 |
| 并发 | 每台归档服务器最多 5 路同时下载；FAQ 说用下载管理器时线程不超过 4 个（归档服务器支持按字节范围请求） |
| 免费额度（捐赠者） | 每周（滑动 168 小时）：Bronze 5 GB、Silver 10 GB、Gold 20 GB、Tristar 40 GB、Quintstar 60 GB、Septuastar 80 GB、Catgirl 及以上 100 GB；只能用于发布 365 天以内的画廊 |
| 免费额度（H@H） | 健康运行 24 小时以上的 H@H 客户端，每天 1,000 MB，另加每「调整后平均命中」10 MB/天，按 7 天滑动窗口计；多开客户端不会多给那 1,000 MB |

归档是否消耗图片配额：Downloading 页只把「手动下载」列为计入浏览限额，归档没列（[EHWiki Downloading](https://ehwiki.org/wiki/Downloading)）；但 2024-08 的公告说「发布一年内的画廊可以用配额下归档」（见[限额与风控](Limits-and-Anti-Crawling.md)）。两处的「配额」可能指不同的东西。【未知】

社区补充：生成归档是异步的（会有「已在处理中」之类的等待状态）；`document.location` 指向的地址加 `?start=1` 才开始下载。【社区：LANraragi、JHenTai】

## 3. H@H 归档（交给账号自己的 H@H 客户端）

1. `GET` 同一个归档链接，用 `<form id="hathdl_form" action="[^"]*?or=([^="]*?)" method="post">` 取 `or` 参数，用 `<a href="[^"]*" onclick="return do_hathdl\('([0-9]+|org)'\)">([^<]+)</a>` 取可选分辨率（[`client/parser/ArchiveParser.java:38-39`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/ArchiveParser.java#L38-L39)）。
2. `POST {host}archiver.php?gid=…&token=…[&or=…]`，表单 `hathdl_xres=<分辨率或 org>`（[`client/EhEngine.java:896-934`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L896-L934)）。
3. 响应里出现 `You must have a H@H client assigned to your account to use this feature.` 就提示「需要 H@H 客户端」，否则显示「已开始」，此外不做任何确认。

客户端自己拿不到字节，文件落在用户的 H@H 客户端那边。【代码】

官方说明（[EHWiki Hentai@Home](https://ehwiki.org/wiki/Hentai@Home)）：

- H@H 下载器让你自己的 H@H 客户端代替 HTTPS 去取归档。
- 可选分辨率：800x、1280x、1920x、2560x、原图。发布超过一年的画廊没有 2560x，最高 1920x。
- 要花 GP / credits，免费额度另算；页面没写费率。
- 排队后不能取消，一周内没完成就丢弃。
- H@H 客户端推荐用 443 端口，1024-65534 之间也可以。

测试夹具里保存的归档页，`hathdl_form` 标签的属性是跨行写的，单空格的 `PATTERN_FORM` 匹配不上；而且没有任何测试覆盖 `ArchiveParser`。今天的真实页面是什么样，不知道。【代码 + 未知】

## 4. 种子

1. 从详情页抓 `<a[^<>]*onclick="return popUp\('([^']+)'[^)]+\)">Torrent Download \((\d+)\)</a>`（[`client/parser/GalleryDetailParser.java:72`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryDetailParser.java#L72)）。
2. `GET` 种子列表页，用 `TorrentParser` 解析出每个种子的文件名和发布时间（[`client/parser/TorrentParser.java:28-30`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/TorrentParser.java#L28-L30)）。
3. 用户点一个，客户端裸 `GET` 那个 `.torrent` 链接（夹具里形如 `https://ehtracker.org/get/<id>/<sha1>.torrent`），存到 `Download/Ehviewer/Torrent/`（[`download/DownloadTorrentManager.kt:32-97`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/download/DownloadTorrentManager.kt#L32-L97)）。

客户端只下载 `.torrent` 文件，不做 BT 下载。种子链接是个人化的（带用户的 tracker key）。【代码 + 推断】
