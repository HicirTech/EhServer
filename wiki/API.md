# API（api.php）

本页是 E-Hentai 的 JSON API：官方文档写了什么、客户端用了哪些方法、请求长什么样、读回哪些字段。这是 E-Hentai 唯一的「结构化」接口，其余全是 HTML。

代码引用指 Ehviewer-Lab `16e019db`，路径相对 `app/src/main/java/com/hippo/ehviewer/`。

## 0. 官方文档

来源：[EHWiki API](https://ehwiki.org/wiki/API)，2026-10 读取。【官方】

| 项 | 内容 |
|---|---|
| 地址 | `https://api.e-hentai.org/api.php`，POST，请求和响应都是 JSON。没有提里站用什么地址 |
| 文档化的方法 | 只有 `gdata` 和 `gtoken` 两个 |
| 每次上限 | `gidlist` 和 `pagelist` 都最多 25 项 |
| 节奏 | 连续 4-5 次请求通常没问题，之后等约 5 秒 |
| `gdata` 返回字段 | `gid`、`token`、`title`、`title_jpn`、`category`、`thumb`、`uploader`、`posted`、`filecount`、`filesize`、`expunged`、`rating`、`torrentcount`、`torrents`（`hash`、`added`、`name`、`tsize`、`fsize`）、`tags`，以及 `parent_gid`/`parent_key`、`current_gid`/`current_key`、`first_gid`/`first_key` |
| 错误 | `gdata` 里 token 不对的那一项会返回「key 缺失或不正确」的错误；`gtoken` 里无效的那一项返回「File not found」 |
| 是否需要登录 | 没有说明 |

据 EHWiki 的修订历史，文档里的地址在 2017-02 从 `https://e-hentai.org/api.php` 改成了 `https://api.e-hentai.org/api.php`；2026-02 的修订从返回字段里删掉了 `archiver_key`。【官方修订历史，研究时读取，本页作者未复核】

## 1. 地址与通用约定

| 项 | 客户端的做法 | 证据 |
|---|---|---|
| 地址 | `https://e-hentai.org/api.php` 或 `https://exhentai.org/api.php`，跟随选站 | [`client/EhUrl.java:51-52`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L51-L52) |
| 方法 | `POST`，`Content-Type: application/json; charset=utf-8` | [`client/EhEngine.java:105`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L105) |
| 头 | 总带 `Origin`；`Referer` 每个方法不同 | 见下表 |
| Cookie | 走同一个 cookie jar | [`EhApplication.java:399`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/EhApplication.java#L399) |
| 身份 | `rategallery`、`votecomment`、`geteditcomment` 要带 `apiuid` 和 `apikey`，两者都来自详情页 HTML | [`client/parser/GalleryDetailParser.java:71`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryDetailParser.java#L71) |

2019 年保存的单页夹具里，页面自己声明的 API 地址是 `https://api.e-hentai.org/api.php`；客户端不用这个地址。【代码】

其他客户端用的地址各不相同【社区，见[其他客户端与先行实现](Prior-Art.md) S14】：

| 客户端 | 表站 | 里站 |
|---|---|---|
| NekoInverter（2023-10 起） | `https://api.e-hentai.org/api.php` | `https://s.exhentai.org/api.php` |
| JHenTai（2026-09） | `https://api.e-hentai.org/api.php` | `https://exhentai.org/api.php` |
| gallery-dl | — | `https://s.exhentai.org/api.php` |
| Ehviewer-Lab | `https://e-hentai.org/api.php` | `https://exhentai.org/api.php` |

表站的 `e-hentai.org/api.php` 现在是否还能用，没有验证。【未知】调用里站的 API 时要带里站的 cookie。【社区】

对 `api.e-hentai.org` 请求过快时，可能收到空的 200 响应（软限流）。【社区，2024-05，见[限额与风控](Limits-and-Anti-Crawling.md)】

## 2. 方法

### `gdata`：批量取画廊元数据

```json
{"method":"gdata","gidlist":[[<gid>,"<token>"], ...],"namespace":1}
```

- 每次最多 25 个（代码注释原话 "We can only request 25 items one time at most"），分批**串行**发，批与批之间没有间隔（[`client/EhEngine.java:303-312`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L303-L312)）。
- `Referer` 是触发它的列表页 URL（[`client/EhEngine.java:330-335`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L330-L335)）。
- 读取：`gmetadata[]` 中每项的 `gid`、`title`、`title_jpn`、`category`、`thumb`、`uploader`、`posted`（秒级时间戳）、`rating`（字符串）、`tags[]`（`namespace:1` 时为 `ns:tag` 形式）、`filecount`（[`client/parser/GalleryApiParser.java:33-58`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryApiParser.java#L33-L58)）。
- 不读：`archiver_key`、`filesize`、`expunged`、`torrentcount`。这些字段只出现在没被使用的 `client/data/GalleryApiInfo.java` 里。
- 没有 `error` 处理。任何一项缺字段，整批都失败。官方文档说，token 不对的那一项会以错误的形式返回，所以客户端只要遇到一个 token 失效的画廊，整批 25 个都会失败。【官方 + 代码】

触发时机：列表页里有「评过分」的行；或者标签过滤需要标签、但页面没给；或者开了「显示页数」、但页面没给（[`client/EhEngine.java:237-242`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L237-L242)）。另外，「从下载目录恢复列表」时会直接调用。

### `gtoken`：用单页 token 反查画廊 token

```json
{"method":"gtoken","pagelist":[[<gid>,"<ptoken>",<页码，从 1 开始>]]}
```

- 字段名叫列表，但客户端每次只发一项（[`client/EhEngine.java:555-558`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L555-L558)）。
- 读取 `tokenlist[0].token`；没有就把 `tokenlist[0].error` 当作错误抛出（[`client/parser/GalleryTokenApiParser.java:35-43`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryTokenApiParser.java#L35-L43)）。
- 用途：用户打开一个 `/s/…` 单页链接时（[`ui/scene/ProgressScene.java:94-106`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/scene/ProgressScene.java#L94-L106)）。

### `showpage`：取单页的图片 URL

```json
{"method":"showpage","gid":<gid>,"page":<页码，从 1 开始>,"imgkey":"<ptoken>","showkey":"<showkey>"}
```

- `showkey` 来自同一本画廊里任意一次单页 HTML（`var showkey="…";`）。
- `Referer` 是上一页的单页 URL（第 1 页没有 Referer）（[`client/EhEngine.java:1242-1245`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L1242-L1245)）。
- 读取：`i3`（含 `<img … src="…" style` 的 HTML 片段 → 图片 URL）、`i6`（`nl('…')` → 跳过 key；也可能含原图链接和静态论坛链接）、`i7`（原图链接，可能为 JSON null）、`error`（[`client/parser/GalleryPageApiParser.java:29-68`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryPageApiParser.java#L29-L68)）。
- 不读：`p`、`s`、`n`、`i`、`k`、`i5`、`si`、`x`、`y`（2019 年夹具里出现过的键）。
- 状态机见[阅读方式](Reading-Pipeline.md)。

### `rategallery`：评分

```json
{"method":"rategallery","apiuid":<uid>,"apikey":"<key>","gid":<gid>,"token":"<token>","rating":<1-10>}
```

`rating = ceil(星数 × 2)`；读取 `rating_avg`、`rating_cnt`（[`client/EhEngine.java:427-433`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L427-L433)、[`client/parser/RateGalleryParser.java:33-37`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/RateGalleryParser.java#L33-L37)）。

### `votecomment`：评论投票

```json
{"method":"votecomment","apiuid":<uid>,"apikey":"<key>","gid":<gid>,"token":"<token>","comment_id":<id>,"comment_vote":1 或 -1}
```

读取 `comment_id`、`comment_score`、`comment_vote`（[`client/parser/VoteCommentParser.java:31-39`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/VoteCommentParser.java#L31-L39)）。

### `geteditcomment`：取待编辑评论的原文

```json
{"method":"geteditcomment","apiuid":<uid>,"apikey":"<key>","gid":<gid>,"token":"<token>","comment_id":<id>}
```

读取 `editable_comment`（一段 HTML，从中取 `textarea[name=commenttext_edit]`）；有 `error` 就报错（[`client/parser/GetEditCommentParser.java:34-55`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GetEditCommentParser.java#L34-L55)）。

## 3. 客户端没用的方法

- `imagedispatch`（MPV 多页浏览器用的方法）：仓库里没有。据其他客户端，它的参数是 `gid`、`page`、`imgkey`、`mpvkey`（可选 `nl`），其中 `mpvkey` 和每页的 `imgkey` 来自 `/mpv/<gid>/<token>/` 页面里的 `mpvkey` 和 `var imagelist`；返回里有 `i`（图片 URL）、`s`（`nl` 用的跳过 key）、`lf`（原图链接）。【社区：EhPanda、NekoInverter，见[其他客户端与先行实现](Prior-Art.md) S13】
- MPV 的使用资格：Gold Star 及以上，或者买了 Multi-Page Viewer perk（300 Hath）。【官方：[Multi-Page Viewer](https://ehwiki.org/wiki/Multi-Page_Viewer)、[Hath Perks](https://ehwiki.org/wiki/Hath_Perks)】客户端通过 `hath_perks` cookie 里的 `q` 标志判断。【社区】
- `votetag`（给标签投票）也要 `apiuid` 和 `apikey`。【社区】
- 2026-07，gallery-dl 调里站 `showpage` 时报「缺参数」，之后修复，但缺的是哪个参数不清楚。【社区，S15】
- 评论的发表和编辑不走 API，而是 POST 详情页表单（[`client/EhEngine.java:466-509`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L466-L509)）。
- 收藏、标签订阅、归档、种子都不走 API，全是 HTML 表单。

## 4. 错误

- API 返回 `{"error":"…"}` 时，JSON 里没有 `<`，所以统一走「把整个响应体当错误信息」这条路。用户看到的是原始 JSON（[`client/EhEngine.java:135-137`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L135-L137)）。
- `showpage` 的 "Key mismatch" 本该触发重新取 showkey，但这个分支走不到（见[请求清单](Request-Inventory.md)）。
