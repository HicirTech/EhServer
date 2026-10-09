# 登录与会话

本页回答：客户端怎么登录、登录后手里握着什么、什么时候认为会话失效。

代码引用指 Ehviewer-Lab `16e019db`，路径相对 `app/src/main/java/com/hippo/ehviewer/`。

## 结论

- 客户端对「已登录」的定义只有一条：`e-hentai.org` 域下同时有 `ipb_member_id` 和 `ipb_pass_hash` 两个 cookie。只看有没有，不验证是否有效（[`client/EhCookieStore.java:53-57`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhCookieStore.java#L53-L57)）。【代码】
- 有四条入口：账号密码、WebView、粘贴 cookie、游客。只有 WebView 和粘贴两条会把凭据复制到 `exhentai.org` 域，账号密码这条不会。【代码】
- 客户端不往服务器推任何账号设置。唯一强制的是对 `*.e-hentai.org` 注入的 `nw=1`，用来跳过内容警告页。【代码】
- 不预先检查里站权限，只在出错时被动识别（Sad Panda、kokomade、空首页）。【代码】
- 退出登录只清本地，不发登出请求。【代码】
- 客户端自己的逻辑里，没有任何东西把会话绑定到设备或 IP：UA 是常量，WebView 拿到的 cookie 会被 OkHttp 换一个 UA 重放。【推断】

## 1. 四条登录入口

启动时先检查 `need_sign_in && !hasSignedIn()`，满足就进登录页（[`client/EhUtils.kt:138-141`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUtils.kt#L138-L141)）。每条入口开始前都先调一次 `EhUtils.signOut` 清空旧会话（[`client/EhUtils.kt:130-136`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUtils.kt#L130-L136)）。

### A. 账号密码

| 项 | 内容 | 证据 |
|---|---|---|
| 请求 | `POST https://forums.e-hentai.org/index.php?act=Login&CODE=01` | [`client/EhUrl.java:47`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L47) |
| 表单 | `UserName`、`PassWord`、`submit=Log me in`、`CookieDate=1`、`temporary_https=off` | [`client/EhEngine.java:172-177`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L172-L177) |
| 额外头 | `Referer: https://forums.e-hentai.org/index.php?act=Login&CODE=00`、`Origin: https://forums.e-hentai.org` | [`client/EhEngine.java:179-180`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L179-L180) |
| 前置请求 / token | 没有：不先 GET 登录页，也没有隐藏字段 | [`client/EhEngine.java:170-207`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L170-L207) |
| 验证码 | 不处理 | — |
| 成功判定 | 响应体匹配 `<p>You are now logged in as: (.+?)<`；但最终以 jar 里是否有那两个 cookie 为准 | [`client/parser/SignInParser.java:27`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/SignInParser.java#L27)、[`ui/scene/sign/SignInScene.java:373`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/scene/sign/SignInScene.java#L373) |
| 失败判定 | `(?:<h4>The error returned was:</h4>\s*<p>(.+?)</p>)\|(?:<span class="postcolor">(.+?)</span>)`，失败时提示改用 WebView 或 cookie 登录 | [`client/parser/SignInParser.java:28-30`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/SignInParser.java#L28-L30) |
| Cookie 落点 | 按服务器 `Set-Cookie` 原样存，**不复制到 exhentai.org** | [`com/hippo/network/CookieRepository.java:153-158`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/network/CookieRepository.java#L153-L158) |

2025-12 起，论坛前面加了 Cloudflare 挑战，其他客户端用脚本 POST 登录时都返回 403，只有网页（WebView）登录能过。2026-10 研究时，对论坛的普通 GET 请求也直接返回了 403 和 Cloudflare 的挑战页。按此推断，这条路在本 app 里大概率也已失效。【社区 + 观察，见[其他客户端与先行实现](Prior-Art.md) S27；本 app 未实测】

另外，账号密码登录从 2024-03 前后开始要验证码（NekoInverter、JHenTai），注册要验证码，禁止用 Tor 注册（[EHWiki Technical Issues](https://ehwiki.org/wiki/Technical_Issues)）。【社区 + 官方】

### B. WebView

1. 清空 `CookieManager`，用 WebView 打开 `https://forums.e-hentai.org/index.php?act=Login`（[`ui/scene/sign/WebViewSignInScene.kt:62-80`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/scene/sign/WebViewSignInScene.kt#L62-L80)）。登录全程由 Chromium 自己发请求，不走 app 的 DNS 和域前置。
2. 每次页面加载完，读取 `CookieManager.getCookie("https://e-hentai.org/")`，把看到的**所有** cookie 同时写入 `e-hentai.org` 和 `exhentai.org` 两个域，强制永不过期（[`ui/scene/sign/WebViewSignInScene.kt:339-361`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/scene/sign/WebViewSignInScene.kt#L339-L361)）。
3. 两个 `ipb_*` 都出现就算成功。这条路没有失败判定，用户看到的就是网页自己的报错。

### C. 粘贴 cookie

- 三个输入框：`ipb_member_id`、`ipb_pass_hash`、`igneous`（可选）。也可以从剪贴板按 `name: value` 逐行导入（[`ui/scene/sign/CookieSignInScene.java:240-273`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/scene/sign/CookieSignInScene.java#L240-L273)）。
- 格式检查：member id 只能是数字，pass hash 必须是 32 位 `[0-9a-z]`。不符合时弹警告，但用户可以坚持保存（[`ui/scene/sign/CookieSignInScene.java:173-195`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/scene/sign/CookieSignInScene.java#L173-L195)）。
- 三个 cookie 各写进 `e-hentai.org`、`exhentai.org`、`forums.e-hentai.org` 三个域，永不过期（[`ui/scene/sign/CookieSignInScene.java:280-300`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/scene/sign/CookieSignInScene.java#L280-L300)）。
- **不发任何请求，也不向服务器验证。**

### D. 游客

强制设为表站，然后 `need_sign_in=false`（[`ui/scene/sign/SignInScene.java:252-256`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/scene/sign/SignInScene.java#L252-L256)）。之后的选站页仍然允许选里站，不检查权限。

### 登录之后

- 拉个人资料：默认配置（域前置开、没检测到 VPN）下**不发请求**，昵称直接写成默认值 "Little Hippo"（[`ui/scene/sign/SignInScene.java:318-330`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/scene/sign/SignInScene.java#L318-L330)）。其他情况下用全屏 WebView 打开论坛首页，直到解析出用户名为止（[`ui/scene/sign/GetProfileScene.kt:57-129`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/scene/sign/GetProfileScene.kt#L57-L129)）。
- 上游提交说明里写了这么做的原因：论坛前面有一层机器人验证，直连或域前置都过不去。（开发者说明，`git f5dfc5a4`、`git a668d4d6`，未实测）
- 昵称和头像写进了设置，但全仓库没有任何地方读取它们。【代码】
- 没有里站探测，没有推送 uconfig，也不请求 home.php。`is_login` 标志只在 `MainActivity.onInit()` 冷启动时计算一次（[`ui/MainActivity.java:485-514`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/MainActivity.java#L485-L514)），所以第一次登录后，到下次冷启动之前，它都是 false。【代码 + 推断】

## 2. Cookie 清单

全仓库出现过的 cookie 名只有：`ipb_member_id`、`ipb_pass_hash`、`igneous`、`uconfig`、`nw`，外加一个没用到的 `xres` 常量。`ipb_session_id`、`yay`、`sk`、`sl`、`sp`、`star`、`hath_perks` 一个都没出现，这些 cookie 即使收到也只是被通用地存下来。【代码，grep】

| Cookie | 来源 | 客户端用途 | 持久化 | 两站之间复制 |
|---|---|---|---|---|
| `ipb_member_id` | 服务器（A、B）或手填（C） | 「已登录」判定的一半 | B、C 和 uconfig 回写都强制永不过期；A 按服务器给的过期时间 | B、C、uconfig 回写会复制；**A 不会** |
| `ipb_pass_hash` | 同上 | 「已登录」判定的另一半；C 要求 32 位 | 同上 | 同上 |
| `igneous` | 手填（C），或里站响应的 `Set-Cookie`（推断） | 里站访问凭据 | 同上 | C 写三个域 |
| `nw` | 客户端常量 `nw=1`，不落库 | 每个发往 `*.e-hentai.org` 的请求都注入，用来跳过内容警告；jar 里如果有别的 `nw` 会被丢掉 | 不持久化 | **不发给 exhentai.org** |
| `uconfig` | 客户端从不生成 | 发往 `*.e-hentai.org` 时会被剥掉 | — | — |

证据：[`client/EhCookieStore.java:32-43`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhCookieStore.java#L32-L43)、[`client/EhCookieStore.java:87-112`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhCookieStore.java#L87-L112)、[`ui/scene/sign/CookieSignInScene.java:289-299`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/scene/sign/CookieSignInScene.java#L289-L299)。

其他客户端处理、本 app 没有处理的 cookie【社区，见[其他客户端与先行实现](Prior-Art.md) S29-S31】：

| Cookie | 作用 |
|---|---|
| `iq` | 花 GP 解锁的 24 小时专属配额 token，设在 e-hentai.org 上 |
| `sp` | 选中的设置配置档。非捐赠者有 3 个配置档，表站和里站的配置档是分开的 |
| `star` | 捐赠等级；访问 news.php 时下发。LANraragi 说有了它不用里站也能看部分受限画廊 |
| `hath_perks` | 站点下发的已购 perk 代码加一个校验值；其中的 `q` 标志表示能用 MPV |
| `sk` | 没有文档；TachiyomiSY 把它当作「设置 key」保存 |
| `datatags` | 设为 1 时，缩略图会附带原图的 SHA-1、大小和尺寸 |
| `cf_clearance` | Cloudflare 放行凭据 |
| `yay` | EhPanda 在里站会删掉它 |

`nw` 是官方说明过的：删掉它就会重新出现内容警告（[EHWiki Technical Issues](https://ehwiki.org/wiki/Technical_Issues)）。【官方】

`igneous` 的无效值有 `mystery`、`null`、`deleted`、`expired`。本 app 会存下服务器发来的任何 `Set-Cookie`，所以一个 `igneous=mystery` 就能覆盖掉原本有效的值。【社区 + 代码】

存储位置：

- OkHttp 的 cookie jar 落在 `okhttp3-cookie.db`，明文 SQLite，不进 Android 自动备份（[`client/EhCookieStore.java:46`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhCookieStore.java#L46)、[`res/xml/backup_scheme.xml:18-23`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/res/xml/backup_scheme.xml#L18-L23)）。
- 主 client 每收到一个 `Set-Cookie`，都会同步写进 WebView 的 `CookieManager`（[`EhApplication.java:411-427`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/EhApplication.java#L411-L427)）。反方向（WebView 写回 OkHttp）只发生在 WebView 登录和 uconfig 页关闭时。

## 3. 里站（ExHentai）访问

- 客户端没有「取得里站权限」这一步。`igneous` 要么用户手填，要么来自服务器的 `Set-Cookie`。没有引导访问，也没有登录后的里站探测。【代码】
- 选站是纯本地设置，切换时不检查权限（[`ui/scene/SelectSiteScene.java:71-85`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/scene/SelectSiteScene.java#L71-L85)）。
- 出错时的识别方式见[选址与网络 · 站点相关的错误识别](Site-Selection-and-Network.md)。列表页的解析器吞掉所有异常，所以列表请求碰到 Sad Panda 时，用户只会看到「没有结果」。【推断，来自控制流】
- 没权限时不会自动退回表站，只有 kokomade 那条提示文字建议用户手动切换。
- 其他客户端的做法：EhPanda 在有登录 cookie、没有 `igneous` 时，直接 GET 一次 `exhentai.org` 来领取；JHenTai 在 `igneous` 无效时不切里站。【社区】
- EHWiki 完全没有提到里站和 `igneous`，下面全是社区资料（见[其他客户端与先行实现](Prior-Art.md) S29）：
  - 带着有效的登录 cookie 访问 `exhentai.org`，站点会下发 `igneous`；没有权限时值是 `mystery`，页面是熊猫图或者空白页。
  - 能不能拿到有效的 `igneous` 和 IP / 地区有关：VPN、代理、机房 IP 常常拿不到，新账号查得更严；JHenTai 维护者在 2025-12 说进里站「需要干净的 IP」。
  - 2024-09 前后起 `igneous` 有了过期时间，过期后站点会重新下发；过期的值会变成 `mystery`。JHenTai 和 NekoInverter 都加了「刷新 igneous」：删掉它再请求一次里站的 uconfig 页。
  - 拿到之后能否在别的设备 / IP 上用：有用户把 `igneous` 从电脑拷到手机上用成功了，但没有资料说明它是否和 IP 绑定。
- 官方规则：每人只允许一个活跃账号，账号共享按多开处理，会被封号（[EHWiki Technical Issues](https://ehwiki.org/wiki/Technical_Issues)、[Bans](https://ehwiki.org/wiki/Bans)）。【官方】

## 4. 账号设置（uconfig / 我的标签）

- `EhConfig` 是一套老的 cookie 编码（`k_v-k_v` 形式，[`client/EhConfig.java:789-821`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhConfig.java#L789-L821)），但 `EhConfig.uconfig()` 没有任何调用点，客户端从不生成 uconfig cookie。【代码】
- 修改账号设置的唯一途径：用 WebView 打开真实的 `uconfig.php` 让用户手动改。WebView 的请求会被拦截，交给 OkHttp 重放；客户端只自动点一下 Apply（[`ui/UConfigActivity.java:86-135`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/UConfigActivity.java#L86-L135)、[`ui/UConfigActivity.java:228-276`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/UConfigActivity.java#L228-L276)）。
- 页面关闭时，把该 URL 下能看到的所有 cookie 写回 jar，两站各一份，永不过期（[`ui/UConfigActivity.java:171-208`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/UConfigActivity.java#L171-L208)）。
- 2023-12 保存的 uconfig 页面里有「配置档」（`profile_set`、`profile_action`），字段名和 `EhConfig` 对不上。EhConfig 已经是遗留编码。【代码，测试夹具 `EhUconfig.html`】
- 解析器依赖的显示设置（列表显示模式、缩略图大小等）客户端不强制，而是让解析器兼容多种模式。列表解析器的测试覆盖两站各 5 种显示模式（[`app/src/test/java/com/hippo/ehviewer/client/parser/GalleryListParserTest.java:43-53`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/test/java/com/hippo/ehviewer/client/parser/GalleryListParserTest.java#L43-L53)）。详见[解析器与数据模型](Parsers-and-Data-Model.md)。
- 「我的标签」（watched / hidden tags）有两条路径：一是 WebView 直接打开 `{site}/mytags`；二是 `EhEngine` 用表单 POST 增删标签，再用 `MyTagLitParser` 解析（[`client/EhEngine.java:1275-1372`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L1275-L1372)）。

## 5. 身份信息

| 信息 | 来源 | 用途 |
|---|---|---|
| member id | `ipb_member_id` 的值 | 设置里的「身份 cookie」对话框，可复制 |
| `apiuid` / `apikey` | 画廊详情页 HTML 里的 `var apiuid = …; var apikey = "…";`（[`client/parser/GalleryDetailParser.java:71`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/GalleryDetailParser.java#L71)） | `api.php` 的评分、评论投票、编辑评论都要带上；`apiuid < 0` 时提示先登录 |
| 昵称、头像 | 论坛页面，或默认值 | 写入设置，但没有地方读取 |

`apikey` 来自页面而不是 cookie。它的生命周期（按账号、按会话还是按页面）不知道。【未知】

## 6. 退出登录与会话失效

- 退出登录清空 jar（所有域，包括内存和 SQLite），清昵称和头像，置 `need_sign_in=true`，然后重启到登录页（[`client/EhUtils.kt:130-136`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUtils.kt#L130-L136)）。
- **不清**：WebView 的 cookie、50 MB 的 HTTP 缓存、`gallery_site`。**不发**任何登出请求，所以服务器端的会话仍然有效。【代码 + 推断】
- 会话失效的检测几乎没有：

| 信号 | 位置 | 反应 |
|---|---|---|
| 收藏页出现 `This page requires you to log on.</p>` | [`client/parser/FavoritesParser.java:52-54`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/FavoritesParser.java#L52-L54) | 报错 "Signing in is required" |
| 详情页 `apiuid < 0` | [`ui/scene/gallery/detail/GalleryDetailScene.java:1537`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/scene/gallery/detail/GalleryDetailScene.java#L1537) | 评分、归档等功能提示先登录 |
| cookie 过期或被服务器清除 | jar 自动丢弃 | 不会重新弹登录页。`need_sign_in` 已是 false，app 静默地以游客身份继续 |
| 401 / 403 / 跳转到登录页 | — | 没有专门处理，也不会自动重新登录 |
