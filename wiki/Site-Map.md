# 站点地图

本页是 E-Hentai 的「地图」：有哪些主机、每类页面的 URL 长什么样、参数是什么意思、列表怎么翻页、外部链接怎么进来。全部以客户端代码为准，客户端没用到的页面不在本页。

代码引用指 Ehviewer-Lab `16e019db`，路径相对 `app/src/main/java/com/hippo/ehviewer/`。`{host}` = `https://e-hentai.org/` 或 `https://exhentai.org/`。

## 1. 主机

| 主机 | 客户端拿它做什么 | 表 / 里 | 证据 |
|---|---|---|---|
| `e-hentai.org` | 表站全部页面和 `api.php`；`home.php`、`toplist.php`、`news.php` 不管选哪个站都走这里 | 表 | [`client/EhUrl.java:38`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L38) |
| `exhentai.org` | 里站全部页面和 `api.php` | 里 | [`client/EhUrl.java:37`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L37) |
| `forums.e-hentai.org` | 登录、注册链接、个人资料页。2025-12 起有 Cloudflare 挑战（见[登录与会话](Login-and-Session.md)） | 共用 | [`client/EhUrl.java:47`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L47) |
| `api.e-hentai.org` | 官方文档里的 API 地址（[EHWiki API](https://ehwiki.org/wiki/API)）。客户端不用它，而是请求 `{host}api.php` | 表 | [`client/EhUrl.java:51-52`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L51-L52) |
| `upld.e-hentai.org` / `upld.exhentai.org` | 以图搜图上传 | 表 / 里 | [`client/EhUrl.java:63-64`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L63-L64) |
| `ehgt.org` | 缩略图，两站都用 | 共用 | [`client/EhUrl.java:85`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L85) |
| `lofi.e-hentai.org` | 只在链接识别里出现，从不请求 | — | [`client/EhUrl.java:39`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L39) |
| `ehtracker.org` | 种子文件（链接来自种子列表页） | 共用 | [`res/xml/network_security_config.xml:25-27`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/res/xml/network_security_config.xml#L25-L27) |
| `ehwiki.org` | 标签释义，在外部浏览器打开 | — | [`client/EhUrl.java:210-212`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L210-L212) |
| 图片服务器（H@H 节点等） | 代码里没有写死，主机名全部来自单页 HTML / API 返回的图片 URL | — | [`spider/SpiderQueen.java:1405`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/spider/SpiderQueen.java#L1405) |
| `repo.e-hentai.org`、`s.exhentai.org` | 只出现在内置 IP 表里，代码里没有其他引用。社区资料：2023-05 起里站缩略图和封面放在 `s.exhentai.org/t/…`，访问时要带登录 cookie；部分客户端把它当作里站的 API 主机（见[其他客户端与先行实现](Prior-Art.md) S4、S14） | 里 | [`client/EhHosts.java:63-65`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhHosts.java#L63-L65) |
| `*.hath.network` | 图片节点（H@H）。社区资料：原图的 `/fullimg/…` 会 302 到这里；2024-10 起预览图也在这里，URL 带有时效 token（S6、S12） | 共用 | — |

## 2. 页面与 URL

| 页面 | URL 模板 | 方法 | 构造位置 |
|---|---|---|---|
| 首页 / 搜索结果 | `{host}?f_cats=…&f_search=…&page=…&advsearch=1&…` | GET | [`client/data/ListUrlBuilder.java:553-673`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/data/ListUrlBuilder.java#L553-L673) |
| 订阅（watched） | `{host}watched?…`，参数同上 | GET | [`client/EhUrl.java:269-278`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L269-L278) |
| 热门 | `{host}popular` | GET | [`client/EhUrl.java:219-227`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L219-L227) |
| 标签 | `{host}tag/{命名空间:标签}[/{页}]` | GET | [`client/data/ListUrlBuilder.java:625-637`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/data/ListUrlBuilder.java#L625-L637) |
| 上传者 | `{host}uploader/{名字}[/{页}]` | GET | [`client/data/ListUrlBuilder.java:612-624`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/data/ListUrlBuilder.java#L612-L624) |
| 排行榜 | `https://e-hentai.org/toplist.php?tl={11\|12\|13\|15}[&p={n}]`（总榜 / 年 / 月 / 昨日） | GET | [`ui/scene/topList/EhTopListAdapter.java:85-97`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/scene/topList/EhTopListAdapter.java#L85-L97) |
| 画廊详情 | `{host}g/{gid}/{token}/[?p={预览页，从 0 开始}][&hc=1]` | GET；POST 用于发评论 | [`client/EhUrl.java:184-193`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L184-L193) |
| 单页 | `{host}s/{ptoken}/{gid}-{页码，从 1 开始}[?nl={key}]` | GET | [`client/EhUrl.java:195-197`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L195-L197) |
| API | `{host}api.php` | POST JSON | [`client/EhUrl.java:126-134`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L126-L134) |
| 收藏夹 | `{host}favorites.php?favcat=0..9&f_search=…&sn=on&st=on&sf=on&page=…&inline_set=fs_f\|fs_p` | GET；POST 用于批量修改 | [`client/data/FavListUrlBuilder.java:111-135`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/data/FavListUrlBuilder.java#L111-L135) |
| 加入收藏 | `{host}gallerypopups.php?gid={gid}&t={token}&act=addfav` | POST | [`client/EhUrl.java:199-201`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L199-L201) |
| 归档 | `{host}archiver.php?gid={gid}&token={token}[&or={or}]` | GET / POST | [`client/EhUrl.java:203-208`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L203-L208) |
| 种子列表 | 详情页里抓到的 `gallerytorrents.php` 链接 | GET | [`client/parser/GalleryDetailParser.java:72`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryDetailParser.java#L72) |
| 我的标签 | `{host}mytags` | GET / POST | [`client/EhUrl.java:106-114`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L106-L114) |
| 账号设置 | `{host}uconfig.php` | WebView | [`client/EhUrl.java:156-164`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L156-L164) |
| 限额 / 个人中心 | `https://e-hentai.org/home.php` | GET / POST | [`client/EhUrl.java:102-104`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L102-L104) |
| 新闻 / 活动 | `https://e-hentai.org/news.php` | GET | [`client/EhUrl.java:49`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L49) |
| 以图搜图 | `https://upld.e-hentai.org/image_lookup.php`、`https://upld.exhentai.org/upld/image_lookup.php` | POST multipart | [`client/EhUrl.java:259-267`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L259-L267) |
| 登录 | `https://forums.e-hentai.org/index.php?act=Login&CODE=01` | POST | [`client/EhUrl.java:47`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L47) |
| 原图 | 单页里的 `…fullimg…` 链接 | GET，读 302 | [`client/parser/GalleryPageParser.java:29`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryPageParser.java#L29) |

### 标识符

| 标识 | 形状 | 出现在 |
|---|---|---|
| gid | 十进制整数 | 详情、单页、API |
| token | 10 位小写十六进制 | 详情 URL：`(\d+)/([0-9a-f]{10})`（[`client/parser/GalleryDetailUrlParser.java:31-35`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryDetailUrlParser.java#L31-L35)） |
| ptoken（imgkey） | 10 位小写十六进制 | 单页 URL、`showpage` 的 `imgkey` |
| 页码 | URL 里从 1 开始，代码内部从 0 开始 | [`client/EhUrl.java:195-197`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L195-L197) |
| 预览页 `p` | 从 0 开始 | 详情 URL |
| showkey | `[0-9a-z]+` | 单页 HTML 的 `var showkey="…";` |
| nl key | 样例形如 `26664-430636` | 单页 HTML 的 `nl('…')` |
| `apiuid` / `apikey` | 整数 / 十六进制 | 详情 HTML 的 `var apiuid = …; var apikey = "…";` |

## 3. 列表 URL 语法

### 查询参数

| 参数 | 值 | 何时出现 |
|---|---|---|
| `f_cats` | **被排除**的分类位掩码：`(~已选) & 0x3ff`，十进制 | 选了分类时 |
| `f_search` | 关键词，`URLEncoder` UTF-8（空格变 `+`） | 关键词非空时 |
| `page` | 页序号，从 0 开始 | 非 0 时 |
| `advsearch=1` | 打开高级搜索 | 用了高级搜索时 |
| `f_sname` `f_stags` `f_sdesc` `f_storr` `f_sto` `f_sdt1` `f_sdt2` `f_sh` `f_sfl` `f_sfu` `f_sft` | `on` | 对应位被选中时 |
| `f_sr=on&f_srdd={2..5}` | 最低评分 | 设了最低评分时 |
| `f_sp=on&f_spf=…&f_spt=…` | 页数范围 | 设了页数范围时 |

证据：[`client/data/ListUrlBuilder.java:566-609`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/data/ListUrlBuilder.java#L566-L609)。参数顺序是 `HashMap` 的迭代顺序，服务器应该不在乎。【推断】

### 分类位掩码

| 分类 | 值 | 分类 | 值 |
|---|---|---|---|
| Misc | `0x1` | Cosplay | `0x40` |
| Doujinshi | `0x2` | Asian Porn | `0x80` |
| Manga | `0x4` | Non-H | `0x100` |
| Artist CG | `0x8` | Western | `0x200` |
| Game CG | `0x10` | 全部 | `0x3ff` |
| Image Set | `0x20` | | |

例：只看 Doujinshi → `f_cats=1021`；全部都要 → `f_cats=0`（[`client/EhConfig.java:285-295`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhConfig.java#L285-L295)）。

### 高级搜索位

`SNAME 0x1`（标题）、`STAGS 0x2`（标签）、`SDESC 0x4`（描述）、`STORR 0x8`（种子文件名）、`STO 0x10`（只看有种子的）、`SDT1 0x20`（低权重标签）、`SDT2 0x40`（被踩标签）、`SH 0x80`（已删除）、`SFL 0x100`（语言）、`SFU 0x200`（上传者）、`SFT 0x400`（标签）。默认 `SNAME|STAGS`（[`widget/AdvanceSearchTable.java:40-50`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/widget/AdvanceSearchTable.java#L40-L50)）。

### 翻页：两套机制

客户端同时支持两种翻页，由响应 HTML 决定用哪种（[`client/parser/GalleryListParser.java:103-186`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryListParser.java#L103-L186)）：

| 模式 | 识别 | 下一页怎么取 |
|---|---|---|
| 页码模式 | 页面上有 `.ptt` 表格 | 总页数从 `.ptt` 读；请求 `page={n}` |
| 游标模式 | 没有 `.ptt` | 从 `.searchnav` 里 `#uFirst` `#uprev` `#unext` `#ulast` 四个链接的 `href` 取，**原样**再请求 |

- 游标模式下，「跳到某一天」由客户端改写 `nextHref` 实现：把 `seek=YYYY-M-D` 或 `jump=1d/3d/1w/2w/1m/6m/1y/2y` 替换进去，没有的话就追加（[`client/data/ListUrlBuilder.java:538-551`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/data/ListUrlBuilder.java#L538-L551)、[`widget/JumpDateSelector.java:99-138`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/widget/JumpDateSelector.java#L99-L138)）。
- 「随机收藏」把 `lastHref` 里的 `&prev=1` 去掉，再拼上 `&next={gid}`（[`ui/scene/gallery/list/FavoritesScene.kt:1625-1658`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/scene/gallery/list/FavoritesScene.kt#L1625-L1658)）。可见游标的值就是 gid。【代码 + 推断】
- 所有翻页链接都必须是**绝对 URL**，否则请求构造器会抛异常（[`com/hippo/okhttp/ChromeRequestBuilder.java:46`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/okhttp/ChromeRequestBuilder.java#L46)）。
- 站点从 2022-11 起改为游标翻页（里站 11-02，表站 11-05）。页码模式是为兼容旧页面保留的。【社区，见[其他客户端与先行实现](Prior-Art.md) S1；夹具 `GalleryListParserNew3.html` 也是游标模式】
- 排行榜的分页仍然是 `&p={n}`。【代码】

## 4. 外部链接怎么进来

Manifest 里声明了 `http` / `https` 两种 scheme，主机为 `exhentai.org`、`e-hentai.org`、`g.e-hentai.org`、`lofi.e-hentai.org`，不限路径（[`AndroidManifest.xml:110-122`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/AndroidManifest.xml#L110-L122)）。进来后依次尝试三个解析器（[`client/EhUrlOpener.kt:35-69`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrlOpener.kt#L35-L69)）：

```
详情：https?://(?:exhentai.org|e-hentai.org|lofi.e-hentai.org)/(?:g|mpv)/(\d+)/([0-9a-f]{10})
单页：https?://(?:exhentai.org|e-hentai.org|lofi.e-hentai.org)/s/([0-9a-f]{10})/(\d+)-(\d+)
列表：主机必须正好是上面三个之一；路径 "" 或 "/" 读查询参数，/uploader/<x>、/tag/<x>、/<整数分类>
```

- 单页链接会先调用 `gtoken` API 反查画廊 token，再打开详情（[`ui/scene/ProgressScene.java:94-106`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/scene/ProgressScene.java#L94-L106)）。
- `/mpv/` 链接被当成详情链接打开，app 里没有 MPV 阅读器。
- `g.e-hentai.org` 能被 manifest 接住，但两个解析器都不认它。
- 列表链接里的 `page`、`next`、`prev`、`seek`、`jump` 不解析，`/popular`、`/watched`、`/favorites.php`、`/toplist.php` 也不认（[`client/parser/GalleryListUrlParser.java:46-72`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryListUrlParser.java#L46-L72)）。
