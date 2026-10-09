# 请求清单

本页是客户端对 E-Hentai 发出的**全部请求**。

代码引用指 Ehviewer-Lab `16e019db`，路径相对 `app/src/main/java/com/hippo/ehviewer/`。`{host}` = `https://e-hentai.org/` 或 `https://exhentai.org/`，取决于 `gallery_site`；`{root}` = 去掉末尾斜杠的 `{host}`。

## 结论

- `client/EhEngine.java` 有 **33 个 public static 方法**（#84 里写的 36 把 3 个静态字段也算进去了），外加 5 个私有辅助方法。`client/EhClient.java` 定义了 28 个 `METHOD_*` 常量，其中 2 个没有调用者。【代码】
- `api.php` 一共用了 6 个方法：`gdata`、`gtoken`、`showpage`、`rategallery`、`votecomment`、`geteditcomment`。**没有** MPV 用的 `imagedispatch`。【代码】
- 还有一批请求不经过 `EhEngine`：阅读流水线直接发的详情页和图片请求、WebView 代发的请求、缩略图和种子 / 归档文件的裸请求。【代码】
- 客户端**完全不识别**封禁文字、429、`Retry-After`。好几个解析器会把任何无法解析的响应（包括封禁页）变成「空结果」。【代码】

## 1. EhEngine 方法总表

「调用方」一列写触发它的功能。`api` 表示 `POST {host}api.php`，JSON 结构见[API](API.md)。

| # | 方法 | 调用方 | 请求 | 关键参数 | 解析器 / 返回 |
|---|---|---|---|---|---|
| E02 | `signIn` | 登录页 | `POST https://forums.e-hentai.org/index.php?act=Login&CODE=01` | 表单 `UserName` `PassWord` `submit` `CookieDate=1` `temporary_https=off` | `SignInParser` → 昵称 |
| E03 | `getGalleryList` | 首页、搜索、标签、上传者、popular、watched、toplist | `GET` 列表 URL（见[站点地图](Site-Map.md)） | URL 由 `ListUrlBuilder` 构造，或直接用上一页的翻页链接 | `GalleryListParser`；缺字段时追加 `gdata` |
| E04 | `fillGalleryListByApi` | 列表补全；从下载目录恢复列表 | api `gdata` | 每批最多 25 个 `[gid, token]`，批与批之间没有间隔 | `GalleryApiParser` |
| E05 | `getGalleryDetail` | 详情页、全部评论、缩略图加载失败后重取 | `GET {host}g/{gid}/{token}/` | `p`（预览页，0 起）、`hc=1`（全部评论） | `GalleryDetailParser` |
| E06 | `getPreviewSet` | 预览图页 | `GET {host}g/{gid}/{token}/?p={n}` | | `GalleryDetailParser.parsePreviewSet` |
| E07 | `rateGallery` | 评分 | api `rategallery` | `apiuid` `apikey` `gid` `token` `rating=ceil(星数×2)` | `RateGalleryParser` |
| E08 | `commentGallery` | 发表 / 编辑评论 | `POST` 详情页 URL | `commenttext_new`，或 `commenttext_edit` + `edit_comment` | 解析返回页里的评论 |
| E09 | `getEditComment` | 取待编辑评论原文 | api `geteditcomment` | `comment_id` | `GetEditCommentParser` |
| E10 | `getGalleryToken` | 打开 `/s/` 单页链接时反查画廊 token | api `gtoken` | 每次只发一个 `[gid, ptoken, page]` | `GalleryTokenApiParser` |
| E11 | `getAllFavorites` | 「随机收藏」 | `GET` 收藏页的翻页链接 | | `FavoritesParser` |
| E12 | `getFavorites` | 云收藏列表 | `GET {host}favorites.php` | `favcat=0..9`、`f_search` + `sn/st/sf=on`、`page`、`inline_set=fs_f/fs_p` | `FavoritesParser` |
| E13 | `addFavorites` | 加入 / 移出云收藏 | `POST {host}gallerypopups.php?gid=&t=&act=addfav` | `favcat=0..9` 或 `favdel`，`favnote`，`submit=Apply Changes`，`update=1` | 不解析响应体 |
| E14 | `addFavoritesRange` | 批量把本地收藏移到云端 | 逐个发 E13，串行 | | — |
| E15 | `modifyFavorites` | 云收藏批量移动 / 删除 | `POST` 收藏页 URL | `ddact=fav0..9` 或 `delete`，重复的 `modifygids[]`，`apply=Apply` | `FavoritesParser` |
| E16 | `getTorrentList` | 种子列表 | `GET` 详情页里抓到的 `gallerytorrents.php` 链接 | | `TorrentParser` |
| E17 | `getTopList` | 排行榜 | `GET https://e-hentai.org/toplist.php`（固定表站） | | `TopListParser` |
| E18 | `getArchiveList` | H@H 归档分辨率列表 | `GET` 详情页里抓到的 `archiver.php` 链接 | | `ArchiveParser.parse` |
| E19 | `getArchiver` | 归档下载对话框（费用、余额） | 同上 | | `ArchiveParser.parseArchiver` |
| E20 | `downloadArchive` | 让账号绑定的 H@H 客户端去下载归档 | `POST {host}archiver.php?gid=&token=[&or=]` | `hathdl_xres=<分辨率或 org>` | 只检查有没有 H@H 客户端 |
| E21 | `downloadArchiver` | 直接下载归档 zip | `POST` 表单 action，再 `GET` `document.location` 指向的地址 | `dltype=org/res`，`dlcheck=Download Original/Resample Archive` | 返回 zip 下载 URL |
| E22 | `getProfile` | **无调用者**（已被 WebView 取代） | `GET https://forums.e-hentai.org/` 后再请求个人页 | | — |
| E23 | `voteComment` | 评论投票 | api `votecomment` | `comment_vote=±1` | `VoteCommentParser` |
| E24 | `imageSearch` | 以图搜图（图片 client） | `POST` multipart 到 `upld` 主机；遇到 302 手动跟一次 | `sfile`，`fs_similar` / `fs_covers` / `fs_exp=on`，`f_sfile=File Search` | `GalleryListParser` |
| E25 | `getGalleryPage` | 阅读 / 下载：单页 HTML | `GET {host}s/{ptoken}/{gid}-{page}`，可附加 `nl=` | | `GalleryPageParser` → 图片 URL、showkey、nl key、原图链接 |
| E26 | `getGalleryPageApi` | 阅读 / 下载：单页 API | api `showpage` | `gid` `page` `imgkey` `showkey` | `GalleryPageApiParser` |
| E27 | `getWatchedList` | 订阅标签列表 | `GET {host}mytags`；未登录时直接返回 null，不发请求 | | `MyTagLitParser` |
| E28 | `addTag` | 订阅 / 屏蔽标签 | `POST {host}mytags`，原始字符串体 | `usertag_action=add&tagname_new=…&tagwatch_new=on` 或 `taghide_new=on`，加 `tagcolor_new`、`tagweight_new=10`、`usertag_target=0` | `MyTagLitParser` |
| E29 | `editWatchedTag` | 空实现 | — | | — |
| E30 | `deleteWatchedTag` | 删除订阅标签 | `POST {host}mytags` | `usertag_action=mass&…&modify_usertags%5B%5D=<id>` | `MyTagLitParser` |
| E31 | `getEhNews` | 冷启动时拉活动面板 | `GET https://e-hentai.org/news.php` | | 取 `#eventpane` |
| E32 | `getHomeDetail` | 限额组件 | `GET https://e-hentai.org/home.php`（固定表站） | | `EhHomeParser` |
| E33 | `resetLimit` | 花 GP 重置限额 | `POST https://e-hentai.org/home.php` | `reset_imagelimit=Reset Limit` | `EhHomeParser` |

E01 `initialize` 不发请求。行号：[`client/EhEngine.java:113`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L113)（E01）至 [`client/EhEngine.java:1437`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L1437)（E33）。

几个值得记住的细节：

- E03 在列表补全（gdata）失败时，整页都算失败，哪怕 HTML 已经解析成功（[`client/EhEngine.java:262-299`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L262-L299)）。【代码】
- E13、E20 成功与否不看响应体，只要不是取消、Sad Panda、kokomade、HTTP ≥ 400 就算成功（[`client/EhEngine.java:692`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L692)、[`client/EhEngine.java:929`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L929)）。【代码】
- E28 想把 tag 名中的 `:`、空格、`#` 编码，但 `String.replace` 的返回值被丢掉了，实际发出去的是原文（[`client/data/userTag/TagPushParam.java:34-51`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/data/userTag/TagPushParam.java#L34-L51)）。【代码】
- E24 的 multipart 部件用了 `MediaType.parse("file")` 这种无效类型。推断这些部件只带 `Content-Disposition`，不带 `Content-Type`（[`client/EhEngine.java:1120-1146`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L1120-L1146)）。【推断】
- E21 第二个请求没登记到任务上，取消不了；它的状态码和响应头也不检查（[`client/EhEngine.java:978-995`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L978-L995)）。【代码】

## 2. 不经过 EhEngine 的请求

| 发起方 | 请求 | 头 | 证据 |
|---|---|---|---|
| 阅读流水线：取 SpiderInfo | `GET {host}g/{gid}/{token}/`，不检查状态码，也不走 EhEngine 的错误识别 | `Referer: {root}` | [`spider/SpiderQueen.java:892-912`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L892-L912) |
| 阅读流水线：补 ptoken | `GET {host}g/{gid}/{token}/?p={k}` | 同上 | [`spider/SpiderQueen.java:914-956`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L914-L956) |
| 阅读流水线：原图跳转 | `GET {原图链接}?nl=…`，用图片 client，不跟随重定向，读取 `Location` | `Referer` = 单页 URL | [`spider/SpiderQueen.java:1384-1411`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L1384-L1411) |
| 阅读流水线：图片本体 | `GET {图片 URL}` | `Referer` = 单页 URL | [`spider/SpiderQueen.java:1424-1451`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L1424-L1451) |
| 缩略图 | `GET {thumb}`，裸 `Request.Builder` | 无 | [`com/hippo/conaco/ConacoTask.java:357`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/conaco/ConacoTask.java#L357) |
| 种子文件 | `GET https://ehtracker.org/get/…torrent`（形如） | 无 | [`download/DownloadTorrentManager.kt:34`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/download/DownloadTorrentManager.kt#L34) |
| 归档 zip | `GET {下载 URL}`，断点续传时带 `Range` | 无 | [`download/ArchiverDownloader.kt:182-186`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/download/ArchiverDownloader.kt#L182-L186) |
| uconfig 页 | WebView 的请求被拦截，交给 OkHttp 重放 | WebView 头叠加 Chrome 头，可能重复 | [`ui/UConfigActivity.java:228-276`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/UConfigActivity.java#L228-L276) |
| 论坛个人页 | WebView（域前置开、未检测到 VPN 时被拦截） | 同上 | [`ui/scene/sign/GetProfileScene.kt:131-192`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/scene/sign/GetProfileScene.kt#L131-L192) |
| 我的标签页 | WebView 自己的网络栈 | WebView 的 | [`ui/MyTagsActivity.java:57-88`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/MyTagsActivity.java#L57-L88) |

## 3. 错误识别路径

`EhEngine` 所有方法出错时都走 `doThrowException`，按下面的顺序判定（[`client/EhEngine.java:117-158`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L117-L158)）：

1. 请求被取消 → `CancelledException`
2. Sad Panda 响应头三件套 → `EhException("Sad Panda")`
3. 响应体含 kokomade 图片地址 → 提示切回表站
4. 解析失败（`ParseException`）时：
   - 响应体里没有 `<` → 把**整个响应体**当作错误信息显示（纯文本或 JSON 错误就是这样露出来的）
   - 响应体为空 → "Empty page"
   - 其他 → "Parse error"，可选把响应体存盘
5. 其他 `EhException` → 原样抛出
6. HTTP ≥ 400 → `StatusCodeException`

注意第 4 步排在第 6 步前面：一个 4xx / 5xx 的 HTML 错误页，如果解析器先抛了异常，用户看到的是 "Parse error"，而不是状态码。【代码】

### 解析器识别的页面文字

| 文字 / 特征 | 含义 | 结果 | 证据 |
|---|---|---|---|
| `<p>(And if you choose to ignore this warning, you lose all rights to complain about it in the future.)</p>` | 内容警告页 | `OffensiveException` | [`client/parser/GalleryDetailParser.java:98`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryDetailParser.java#L98) |
| `<p>This gallery is pining for the fjords.</p>` | 画廊已删除 | `PiningException` | [`client/parser/GalleryDetailParser.java:100`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryDetailParser.java#L100) |
| `This gallery is unavailable` | 画廊不可用 | `GalleryUnavailableException` | [`client/parser/GalleryDetailParser.java:102`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryDetailParser.java#L102) |
| `<div class="d">\n<p>([^<]+)</p>` | 站点通用错误框 | `EhException(第 1 组)` | [`client/parser/GalleryDetailParser.java:70`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryDetailParser.java#L70) |
| `This page requires you to log on.</p>` | 需要登录 | "Signing in is required" | [`client/parser/FavoritesParser.java:52`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/FavoritesParser.java#L52) |
| `You must have a H@H client assigned to your account to use this feature.` | 没有 H@H 客户端 | `NoHAtHClientException` | [`client/EhEngine.java:109`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L109) |
| 图片 URL 以 `/509.gif` 或 `/509s.gif` 结尾 | 图片限额用尽 | `Image509Exception` | [`spider/SpiderQueen.java:116-119`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L116-L119) |
| JSON 里有 `error` 字段 | API 报错 | 经第 4 步变成「显示原始 JSON」 | [`client/parser/GalleryPageApiParser.java:40-42`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryPageApiParser.java#L40-L42) |

### 「吞掉异常」的解析器

下面这些解析器会把任何无法解析的响应变成空结果或默认值，**不报错**。所以封禁页、Sad Panda、403、503 到了这里，都只表现为「空」：

- `GalleryListParser.parse(String, int)`：列表、以图搜图（[`client/parser/GalleryListParser.java:93-101`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryListParser.java#L93-L101)）
- `EhHomeParser`：限额（[`client/parser/EhHomeParser.java:49-52`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/EhHomeParser.java#L49-L52)）
- `TorrentParser`、`ArchiveParser`
- `MyTagLitParser`（[`client/parser/MyTagLitParser.java:47`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/MyTagLitParser.java#L47)）

### 客户端完全不识别的

- 封禁文字：仓库里搜不到 "banned"、"temporarily"、"excessive"。
- 429、`Retry-After`、任何限速响应。
- `showpage` 返回 "Key mismatch" 时有一个「重取 showkey」的分支，但第 4 步已经把 `ParseException` 换成了新的 `EhException`，这个分支永远进不去（[`spider/SpiderQueen.java:1362-1366`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L1362-L1366)）。实际效果是：页面直接失败，错误信息是原始 JSON。【代码 + 推断，未运行】

## 4. 线程、取消、重试

- 每个 `EhRequest` 是一个 `AsyncTask`，跑在全局 `IoThreadPoolExecutor` 上：核心 3 线程，最多 32 线程，和应用里其他十几处 IO 共用（[`client/EhClient.java:84-88`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhClient.java#L84-L88)、[`com/hippo/util/IoThreadPoolExecutor.kt:69-72`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/util/IoThreadPoolExecutor.kt#L69-L72)）。
- 取消靠 `call.cancel()`。已经发出去的 POST 不会被撤回。阅读流水线直接调用 `EhEngine`，不经过 `EhRequest`，取消不了。
- `EhClient` / `EhEngine` 没有任何应用层重试，只有 OkHttp 的连接失败重试。唯一的重试循环在阅读流水线里：每页最多 5 次（见[阅读方式](Reading-Pipeline.md)）。
- `client/` 下没有设置任何单请求超时，用的是 client 级别的 10 秒。

## 5. 死代码

`METHOD_GET_PROFILE` / `getProfile`、`METHOD_EDIT_WATCHED` / `editWatchedTag`、`EmptyGalleryException`（从未抛出）、`EhConfig.uconfig()`（无调用者）、`callApi` 参数（E12、E15 都不读它）。【代码】
