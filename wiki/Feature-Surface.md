# 功能面

本页回答：客户端里哪些功能会访问 E-Hentai，哪些只在本地处理 E-Hentai 的数据，以及它还依赖哪些 E-Hentai 之外的数据源。

代码引用指 Ehviewer-Lab `16e019db`，路径相对 `app/src/main/java/com/hippo/ehviewer/`。

## 结论

- 访问 E-Hentai 的功能有 27 个调用点，分布在 20 个左右的界面类里；还有阅读流水线、缩略图加载等不经过 `EhClient` 的路径。【代码】
- 只在本地处理的功能有：屏蔽规则、标签翻译、历史、快速搜索、下载标签、本地收藏、阅读进度、黑名单、搜索建议、自定义 hosts。其中屏蔽规则在缺数据时会触发 gdata 请求。【代码】
- E-Hentai 之外，客户端还会从 GitHub 拉取社区维护的标签翻译库。【代码】

## 1. 访问 E-Hentai 的功能

| 功能 | 界面类 | 用到的请求 |
|---|---|---|
| 登录 | `ui/scene/sign/SignInScene.java`、`WebViewSignInScene.kt`、`CookieSignInScene.java`、`GetProfileScene.kt` | E02，WebView |
| 画廊列表、搜索、标签、上传者、popular、watched | `ui/scene/gallery/list/GalleryListScene.java` | E03 |
| 以图搜图（分享图片给 app） | 同上 | E24 |
| 详情、评分、归档、H@H 归档 | `ui/scene/gallery/detail/GalleryDetailScene.java` | E05、E07、E18、E20 |
| 归档下载对话框 | `ui/dialog/ArchiverDownloadDialog.java` | E19、E21 |
| 种子 | `ui/scene/gallery/detail/TorrentDownloadController.java` | E16 |
| 预览图 | `ui/scene/GalleryPreviewsScene.java` | E06 |
| 评论（看全部、发表、编辑、投票） | `ui/scene/GalleryCommentsScene.java` | E05、E08、E09、E23 |
| 云收藏（列表、加入、批量、随机） | `ui/scene/gallery/list/FavoritesScene.kt`、`ui/CommonOperations.java` | E11-E15 |
| 排行榜 | `ui/scene/topList/EhTopListScene.kt` | E17 |
| 订阅标签 | `ui/scene/gallery/list/SubscriptionDraw.java`、`SubscriptionsScene.java`、`GalleryListSceneDialog.kt` | E27、E28、E30 |
| `/s/` 单页链接反查画廊 | `ui/scene/ProgressScene.java` | E10 |
| 限额显示与重置 | `widget/LimitsCountView.kt` | E32、E33 |
| 活动面板（冷启动） | `ui/splash/SplashActivity.kt` | E31 |
| 账号设置、我的标签 | `ui/UConfigActivity.java`、`ui/MyTagsActivity.java` | WebView |
| 阅读与下载 | `spider/SpiderQueen.java` | E25、E26、直连详情页和图片 |
| 缩略图 | `com/hippo/conaco/ConacoTask.java` | 裸 GET |
| 从下载目录恢复列表 | `preference/RestoreDownloadPreference.kt` | E04 |

E 编号见[请求清单](Request-Inventory.md)。

## 2. 只在本地处理的功能

| 功能 | 位置 | 存什么 | 备注 |
|---|---|---|---|
| 屏蔽规则（标题、上传者、标签、命名空间） | `client/EhFilter.java` | `eh.db` 表 `FILTER` | 列表返回后在本地过滤。标签过滤缺数据时会触发 gdata 补全（[`client/EhEngine.java:237-242`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L237-L242)） |
| 标签翻译 | `client/EhTagDatabase.java` | `files/tag-translations/` | 每次启动都先请求 GitHub 上的 sha1，内容变了才下载数据（[`ui/MainActivity.java:416`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/MainActivity.java#L416)） |
| 历史 | `dao/HistoryDao.java` | `eh.db` 表 `HISTORY` | 默认最多 100 条 |
| 快速搜索 | `dao/QuickSearchDao.java` | `QUICK_SEARCH` | |
| 下载记录与标签 | `dao/DownloadsDao.java`、`dao/DownloadLabelDao.java` | `DOWNLOADS`、`DOWNLOAD_LABELS` | |
| 本地收藏 | `dao/LocalFavoritesDao.java` | `LOCAL_FAVORITES` | 槽位 -1；云收藏是 0-9 |
| 阅读进度 | `spider/SpiderInfo.java` | 每本画廊的 `.ehviewer` | |
| 评论黑名单 | `dao/BlackListDao.java` | `Black_List` | 没找到把它用于列表过滤的代码 |
| 搜索建议 | `widget/SearchDatabase.java` | `search_database.db` | |
| 自定义 hosts | `Hosts.java` | `hosts.db` | 影响所有 OkHttp 请求的 DNS |
| Cookie | `client/EhCookieStore.java` | `okhttp3-cookie.db` | 见[登录与会话](Login-and-Session.md) |

## 3. E-Hentai 之外的数据源

| 目标 | 用途 | 证据 |
|---|---|---|
| `raw.githubusercontent.com/Mapaler/EhViewer/tag-translations/...`（默认），简体中文用 `raw.githubusercontent.com/xiaojieonly/EhTagTranslation/main/...` | 社区维护的 E-Hentai 标签翻译库 | [`res/values/arrays.xml:392-394`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/res/values/arrays.xml#L392-L394)、[`res/values-zh-rCN/arrays.xml:30-32`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/res/values-zh-rCN/arrays.xml#L30-L32) |
| `https://77.88.8.1/dns-query` | DoH，默认关 | [`client/EhHosts.java:126`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhHosts.java#L126) |
| `https://ehwiki.org/wiki/<tag>` | 在外部浏览器里打开标签释义，客户端自己不请求 | [`client/EhUrl.java:210-212`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L210-L212) |

## 4. 改变 E-Hentai 流量的设置项

| 键 | 默认 | 作用 |
|---|---|---|
| `gallery_site` | 0（表站） | 选站 |
| `built_in_hosts` / `built_ex_hosts` | 开 / 开 | 内置 IP 表 |
| `dns_over_https` | 关 | DoH |
| `domain_fronting` | 开 | 不发 SNI（未检测到 VPN 时） |
| `proxy_type` / `proxy_ip` / `proxy_port` | 系统代理 | 代理 |
| `download_thread` | 3 | 每本画廊的工作线程 |
| `preload_image` | 5 | 预加载页数 |
| `download_delay` | 0 | 每页成功后的间隔，没有界面 |
| `download_timeout` | 0 | 图片请求整体超时 |
| `download_origin_image` | 关 | 下原图 |
| `thumb_resolution` | 0 | 改写缩略图尺寸后缀（250 / 300） |
| `show_eh_events` / `show_eh_limits` | 开（且要已登录） | 冷启动拉 news.php；限额组件拉 home.php |
| `show_gallery_pages` | 关 | 开了会为补页数而触发 gdata |

证据：`Settings.java` 中对应的键（[`Settings.java:420`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/Settings.java#L420)、[`Settings.java:1223`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/Settings.java#L1223)、[`Settings.java:1361`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/Settings.java#L1361)、[`Settings.java:1377`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/Settings.java#L1377)、[`Settings.java:867`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/Settings.java#L867)、[`Settings.java:1390`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/Settings.java#L1390)、[`Settings.java:1556`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/Settings.java#L1556)、[`Settings.java:910`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/Settings.java#L910)）。
