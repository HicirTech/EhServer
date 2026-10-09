# 解析器与数据模型

本页回答：客户端怎么从 E-Hentai 的 HTML / JSON 里把数据抠出来，抠出来的数据长什么样，哪些地方最容易因为站点改版而坏掉。

代码引用指 Ehviewer-Lab `16e019db`，路径相对 `app/src/main/java/com/hippo/ehviewer/`。测试夹具在 `app/src/test/resources/com/hippo/ehviewer/client/parser/`。

## 结论

- `client/parser/` 下有 22 个解析器类，外加一个 `ParserUtils`（#84 里写的「23 个 parser」把它也算进去了）。【代码】
- 有两种解析风格：用 Jsoup 走 DOM 树（列表、收藏、详情的头部 / 标签 / 评论、home、排行榜、mytags），和用正则直接匹配原始 HTML（详情页的脚本变量 / 分页 / 预览图、单页、种子、归档、登录）。正则要求标记逐字节相邻，DOM 方式依赖 class / id 名和子元素下标。【代码】
- **页面长什么样取决于登录账号的显示设置**，客户端不强制任何设置。列表的 5 种显示模式各有一套标记，解析器都得兼容。【代码 + 推断】
- 站点改版是常态：2023-10 到 2025-11，上游因此改了约 10 次解析器，2024-10 的五天里就紧急修了 4 次详情页（见第 5 节）。【代码，git 历史】
- 出错的语义差别很大：列表解析器吞掉一切异常，返回空列表；详情解析器对三个正则硬失败；收藏解析器断言恰好有 11 个 `.fp` 元素。【代码】

## 1. 解析器一览

| 解析器 | 输入 | 风格 | 出错时 |
|---|---|---|---|
| `GalleryListParser` | 列表 HTML（首页、搜索、watched、popular、标签、上传者、分页的排行榜、以图搜图结果） | Jsoup | 字符串入口**吞掉一切异常**，返回空结果 |
| `FavoritesParser` | `favorites.php` | Jsoup，复用列表解析 | 没登录时报错；结构不对时抛 `ParseException` |
| `GalleryDetailParser` | 详情 HTML | 正则 + Jsoup | 内容警告 / 已删除 / 不可用 / 站点错误框各抛专门的异常；三个关键正则不匹配就硬失败 |
| `GalleryApiParser` | `gdata` JSON | JSON | 缺任何一个键都抛异常，整批 25 个一起失败 |
| `GalleryTokenApiParser` | `gtoken` JSON | JSON | 返回里有 `error` 就抛 |
| `GalleryPageParser` | 单页 HTML | 正则 | 图片 URL 或 showkey 缺一个就失败 |
| `GalleryPageApiParser` | `showpage` JSON | JSON + 正则 | 有 `error` 或图片 URL 为空就失败 |
| `TorrentParser` | 种子列表 HTML | 正则 | 从不报错，返回空数组 |
| `ArchiveParser` | 归档页 HTML | 正则 + **DOM 下标** | 从不报错，字段为 null |
| `TopListParser` | `toplist.php` 总览 | Jsoup 下标 | 下标越界时直接抛运行时异常 |
| `EhHomeParser` | `home.php` | Jsoup + 正则 | 从不报错，返回默认值 |
| `EhEventParse` | 任意页面里的 `#eventpane` | Jsoup | 从不报错 |
| `MyTagLitParser` | `mytags` | Jsoup | 只认错误框，其他问题吞掉，可能返回半张表 |
| `SignInParser`、`ForumsParser`、`ProfileParser` | 论坛页面 | 正则 / Jsoup | 抛 `ParseException` |
| `RateGalleryParser`、`VoteCommentParser`、`GetEditCommentParser` | 对应 API 的 JSON | JSON | 抛异常 |
| `GalleryDetailUrlParser`、`GalleryPageUrlParser`、`GalleryListUrlParser` | URL 字符串 | 正则 | 返回 null |

## 2. 显示设置决定页面形状

列表页有 5 种显示模式，标记完全不同（[`client/parser/GalleryListParser.java:288-454`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryListParser.java#L288-L454)；测试夹具覆盖两站各 5 种，均为 2019 年抓取）：

| | Minimal | Minimal+ | Compact | Extended | Thumbnail |
|---|---|---|---|---|---|
| 容器 | `table.itg.gltm` | `table.itg.gltm` | `table.itg.gltc` | `table.itg.glte` | `div.itg.gld` |
| 标题 | `td.gl3m.glname` | 同左 | `td.gl3c.glname` | `div.gl4e.glname`（父元素是 `<a>`） | `div.gl4t.glname` |
| 封面 | `.glthumb` 的 img（`src` 或懒加载的 `data-src`） | 同左 | 同左 | `td.gl1e` img | `div.gl3t` img |
| 上传者 | 有 | 有 | 有 | 有 | **没有** |
| 简要标签 | 无 | 无 | 无 | **只有这种模式有** | 无 |

会影响解析的账号设置（来自 2023-12 保存的 uconfig 页面）：

| 设置 | 影响 |
|---|---|
| `dm` 显示模式 | 整个列表的标记 |
| `lt` 列表缩略图加载方式 | Minimal / Compact 下的懒加载（`data-src`） |
| `ts` / `tr` 缩略图大小 / 行数 | 详情页预览图的 class（`gt100` / `gt200`）、每页预览数、预览页数 → 直接影响阅读流水线取 ptoken 的次数 |
| `pn` 页码标注 | 预览图外面多一层标签，需要另一组正则 |
| `tl` 标题语言 | 列表里的标题是英文还是日文；列表从来拿不到另一种标题 |
| `rc` 每页结果数 | 25 / 50 / 100 行 |
| `ru` 评分颜色 | `irr` / `irg` / `irb` 这几个 class，用来判断「我评过分」 |
| 过滤阈值、排除的语言 / 上传者 / 命名空间 | 结果行被删掉，页面上会写「过滤掉了 N 个」 |
| `fs`、`favorite_0..9` | 收藏夹排序、收藏夹名字 |
| `cs`、`tb` | 评论顺序、标签顺序 |
| `xr`、`oi`、`uh` | 图片尺寸、总是原图、H@H，对单页的影响未知 |
| `qb` | 默认阅读器是不是 MPV。设成 MPV 时 `/s/` 页面会变样（社区） |

官方给出的默认值和上限：缩略图默认 4 行，有 perk 最多 40 行；每页默认 25 条结果，有 perk 最多 100 条；图片尺寸默认 Auto，一般是 1280x（[EHWiki Galleries](https://ehwiki.org/wiki/Galleries)、[My Home](https://ehwiki.org/wiki/My_Home)、[Hath Perks](https://ehwiki.org/wiki/Hath_Perks)）。【官方】

配置档：非捐赠者有 3 个，表站和里站各自独立，由 `sp` cookie 选择。【社区：JHenTai #58、TachiyomiSY】

## 3. 数据模型

### `GalleryInfo`（[`client/data/GalleryInfo.java:108-137`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/data/GalleryInfo.java#L108-L137)）

| 字段 | 含义 | 来源 |
|---|---|---|
| `gid`、`token` | 画廊 id、10 位十六进制 token | 列表（链接）、详情（脚本变量） |
| `title` / `titleJpn` | 标题 / 日文标题；列表只有前者 | 列表、详情、API |
| `thumb` | 封面 URL | 列表、详情、API |
| `category` | 分类位，未知时为 `0x400` | 三处都有 |
| `posted` | 发布时间。HTML 里是站点原文 `yyyy-MM-dd HH:mm`；API 填的是按**设备时区**格式化的字符串 | 列表、详情、API |
| `uploader` | 上传者；Thumbnail 模式下为 null | 列表、详情、API |
| `rating` | 列表按半星解码；详情是平均分；-1 表示无法解析或没人评过 | 列表、详情、API |
| `rated` | 当前账号评过分 | 只有列表 |
| `simpleTags` | `命名空间:标签` 数组 | 列表（Extended）、API |
| `pages` | 页数 | 列表、详情、API 的 `filecount` |
| `favoriteSlot` | -2 未收藏、-1 本地、0-9 云端 | 列表（按颜色反推） |
| `simpleLanguage` | 14 种语言之一，由标签或标题正则推断 | 客户端推断 |

### `GalleryDetail`（继承 `GalleryInfo`，[`client/data/GalleryDetail.java:31-58`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/data/GalleryDetail.java#L31-L58)）

多出：`apiUid`、`apiKey`、`torrentCount` / `torrentUrl`、`archiveUrl`、`parent`、`visible`、`language`、`size`、`favoriteCount`、`isFavorited` / `favoriteName`、`ratingCount`、`tags`（标签组）、`comments`、`previewPages`、`previewSet`、`newVersions`，以及阅读流水线专用的一组 `SpiderInfo*` 字段（用正则重新解析一遍得到）。

### 预览

- `NormalPreviewSet`：雪碧图模式，记录图片 URL、x 偏移、裁剪宽高、单页 URL（[`client/data/NormalPreviewSet.java:26-56`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/data/NormalPreviewSet.java#L26-L56)）。现在的「大缩略图」布局（`gt200`、`0 0`）也被解析进这个类，只是偏移为 0。
- `LargePreviewSet`：一张图对应一页，不裁剪（[`client/data/LargePreviewSet.java:27-37`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/data/LargePreviewSet.java#L27-L37)）。
- 每个预览项的单页 URL `…/s/<ptoken>/<gid>-<page>`，就是 ptoken 表的来源。

### 其他

`HomeDetail`（限额已用 / 上限 / 重置费用、GP 来源、管理权重）、`EhTopListDetail`（7 类 × 4 个时间段）、`UserTag`（订阅 / 屏蔽、颜色、权重）、`ArchiverData`（余额、两档的价格 / 大小 / 表单 action）、`TorrentInfo`（URL、名字、时间）、`GalleryComment`（id、分数、投票状态、时间、用户、HTML 正文）。

## 4. 编码

### 评分（列表）

取 `.ir` 的 `style` 里前两个 `\d+px`：`星数 = 5 - x/16`；如果 `y == 21`，再减半星。例：`0px -1px` = 5，`-16px -21px` = 3.5，`-80px -1px` = 0（[`client/parser/GalleryListParser.java:242-265`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryListParser.java#L242-L265)）。详情页直接读 `#rating_label` 的文字（`Average: 4.46`），API 返回字符串。评分请求发的是 `ceil(星数×2)`，取值 1-10。

### 收藏夹

槽位 0-9。列表里通过行背景色反推槽位（[`client/parser/GalleryListParser.java:57-68`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryListParser.java#L57-L68)）：

| 槽 | RGB | 槽 | RGB |
|---|---|---|---|
| 0 | 0,0,0 | 5 | 144,240,64 |
| 1 | 240,0,0 | 6 | 64,176,240 |
| 2 | 240,160,0 | 7 | 0,0,240 |
| 3 | 208,208,0 | 8 | 80,0,128 |
| 4 | 0,128,0 | 9 | 224,128,224 |

### 分类

位掩码见[站点地图](Site-Map.md)。客户端看的是分类**文字**（如 `Doujinshi`、`Artist CG`），不看 `ctN` 这个 class（[`client/EhUtils.kt:72-100`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUtils.kt#L72-L100)）。

### 时间

| 位置 | 格式 | 处理 |
|---|---|---|
| 列表、详情、种子 | `yyyy-MM-dd HH:mm` 文本 | 原样保存，不带时区 |
| API `posted` | 秒级时间戳 | 按设备时区格式化 |
| 评论 | `dd MMMM yyyy, HH:mm` | 按 UTC 解析（[`client/parser/GalleryDetailParser.java:92-96`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryDetailParser.java#L92-L96)） |

推断站点显示的时间是 UTC。所以同一个列表里，没补过 gdata 的行是站点时区，补过 gdata 的行是设备时区。【推断】

### 缩略图 URL

- 列表封面：`https://ul.ehgt.org/<xx>/<yy>/<sha1>-<字节>-<宽>-<高>-<扩展名>_250.jpg`；里站是 `https://exhentai.org/t/<xx>/<yy>/…`。客户端会统一改写成 `https://ehgt.org/<xx>/<yy>/…`（[`client/EhUrl.java:290-318`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L290-L318)）。
- `thumb_resolution` 设置会把文件名末尾的 `_250` 换成 `_300`。站点是否真的提供 `_300`，不知道（[`client/EhUtils.kt:180-201`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUtils.kt#L180-L201)）。
- 旧式雪碧图：`https://ehgt.org/m/<gid/1000，补齐 6 位>/<gid>-<nn>.jpg`。

### 游标

列表的翻页链接形如 `…&next=<gid>`、`…&prev=1`；收藏夹的形如 `…&next=<gid>-<时间戳>`、`…&prev=1-0`（夹具 `GalleryListParserNew3.html`、`FavoritesListParser.html`）。夹具里「第一页」的 id 是小写的 `ufirst`，而解析器找的是 `uFirst`（[`client/parser/GalleryListParser.java:113`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryListParser.java#L113)）。Jsoup 的 id 查找区分大小写，所以 `firstHref` 恒为空。【代码 + 推断】

## 5. 站点改版时间线（上游为此修改解析器的提交）

| 日期 | 提交 | 改了什么 |
|---|---|---|
| 2023-10-16 | `f6364c76` | 新增限额显示和重置（旧版 home.php 文案） |
| 2023-10-27 | `eeaeba87`、`d5616105` | 紧急修复：E 站页面结构变化导致解析失败 |
| 2023-11-11 | `c87fb689`、`da7e2afc` | 紧急修复：原图链接取不到 |
| 2024-08-14 | `ac0fda84` | 表站列表页结构变化，标签取不到 |
| 2024-08-27 | `f33169d6` | home.php 限额文案改了 |
| 2024-09-18 | `122ce51f` | 部分画廊的上传者评论无法显示 |
| 2024-10-25 至 10-29 | `32e1e689`、`a3a0b62e`、`12f2d13d`、`e1f4d209` | 详情页正则连续 4 次紧急修复：缩略图设置为 small、开启页码标注时都会失败 |
| 2025-06-29 | `dcfe6ee8` | home.php 出现「按 IP 限制」的新文案 |
| 2025-11-26 | `fc883f6c` | 里站 igneous 错误时给出提示 |

其他客户端看到的站点变化（游标翻页、缩略图移到 `s.exhentai.org` 和 `*.hath.network`、相对路径的缩略图 URL、40 位页 token、原图链接从 `i7` 挪到 `i6` 等）见[其他客户端与先行实现](Prior-Art.md)第 2 节。其中两条本 app 可能还没跟上：

- 2024-10 起，详情页的缩略图 URL 改成相对路径，而 `parserNewPreview` 会把 `url(...)` 里的值原样保留（[`client/parser/GalleryDetailParser.java:770-796`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryDetailParser.java#L770-L796)）。【社区 + 代码，推断可能出问题，没有样本】
- 开了 `datatags` 时页 token 可能是 40 位，而 URL 解析器只接受 10 位（[`client/parser/GalleryPageUrlParser.java:30-34`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryPageUrlParser.java#L30-L34)）。【社区 + 代码】

## 6. 最脆弱的 10 处

| # | 位置 | 依赖 | 坏了会怎样 |
|---|---|---|---|
| 1 | 详情页预览网格（[`client/parser/GalleryDetailParser.java:80-87`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryDetailParser.java#L80-L87)） | 7 个正则，跟着 `ts`、`tr`、`pn` 设置变 | 预览集合为空 → 拿不到 ptoken → **阅读器无法翻页** |
| 2 | 详情页三个硬失败正则（[`client/parser/GalleryDetailParser.java:71`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryDetailParser.java#L71)、[`client/parser/GalleryDetailParser.java:78-79`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryDetailParser.java#L78-L79)） | `var gid = ` 的空格、`</td><td` 紧挨着、复数的 `pages` | 整个详情页失败，阅读也跟着失败 |
| 3 | 单页 HTML 和 `showpage` JSON（[`client/parser/GalleryPageParser.java:27-31`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryPageParser.java#L27-L31)） | `src` 后面紧跟 ` style`、`nl('…')`、`fullimg`、`var showkey="…";` | 拿不到图片 URL |
| 4 | 列表分页（[`client/parser/GalleryListParser.java:106-200`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryListParser.java#L106-L200)） | `.ptt` 或 `.searchnav` 的 id、`Found .* results` | 空列表、数量错、没有「第一页」链接 |
| 5 | 列表行选择器（[`client/parser/GalleryListParser.java:288-454`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryListParser.java#L288-L454)） | `glname`、`glthumb`、`gl1e` 等 class 和 `nth-child` 链 | 行被跳过；整页被吞成空列表 |
| 6 | home.php（[`client/parser/EhHomeParser.java:20-21`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/EhHomeParser.java#L20-L21)） | `homebox` 的下标、带换行的文案 | 显示默认值，只记日志 |
| 7 | 按下标取 DOM：归档、排行榜、收藏、论坛 | 子元素下标，恰好 11 个 `.fp` | 字段为空、越界、`ParseException` |
| 8 | 评论（[`client/parser/GalleryDetailParser.java:469-545`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryDetailParser.java#L469-L545)） | 兄弟元素的 `name`、`ownText()` 以 ` by:` 结尾、日期格式 | 评论静默丢失 |
| 9 | 评分和「评过」（[`client/parser/GalleryListParser.java:242-265`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryListParser.java#L242-L265)） | 前两个 `\d+px`、`irr/irg/irb` | 评分为 -1；「评过」判断错 |
| 10 | 英文字面量（`Add to Favorites`、`Not Yet Rated`、`click to show all` 等） | 原文完全一致 | 标志位和计数出错 |

## 7. 测试夹具

`app/src/test/resources/com/hippo/ehviewer/client/parser/` 下有 33 个保存下来的真实页面，只有 13 个被测试引用。可见的抓取时间：列表 2019-04、收藏 2024-09、详情 2024-10、home.php 三份（2023-10、2024-08、2025-06）、种子列表 2026-04。只有种子列表是原始字节，其余看起来重新缩进过。

部分夹具里含有账号相关的值：`apikey`、EHTracker 个人 key、论坛登出 key。【代码】
