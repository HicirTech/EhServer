# 选址与网络

本页回答两件事：客户端怎么决定访问表站还是里站；为了「连得上」，它在网络层做了哪些处理。

代码引用指 Ehviewer-Lab `16e019db`，路径相对 `app/src/main/java/com/hippo/ehviewer/`，`com/hippo/...`、`res/...` 开头的除外。

## 结论

- 站点选择只有一个设置 `gallery_site`（0 = e-hentai.org，1 = exhentai.org），没有自动探测，也没有回退。有几类端点不管怎么设都走 e-hentai.org。【代码】
- 网络层为「连得上」做了四件事：用户 hosts 表、内置 IP 表、DoH、域前置（不发 SNI）。都是为手机所在网络不可靠准备的。【代码 + 推断】

## 1. 表站 / 里站

| 项 | 事实 | 证据 |
|---|---|---|
| 设置项 | `gallery_site`，整数存成字符串；0 = E，1 = EX；代码默认 0 | [`Settings.java:420-425`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/Settings.java#L420-L425) |
| 设置页的默认值 | XML 写的是 `"1"`，和代码默认值 0 不一致 | [`res/xml/eh_settings.xml:39`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/res/xml/eh_settings.xml#L39) |
| 首次启动 | `SelectSiteScene` 让用户选，同时把 `select_site` 置为 false | [`ui/scene/SelectSiteScene.java:74-85`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/scene/SelectSiteScene.java#L74-L85) |
| 跳过登录 | 强制设为 E | [`ui/scene/sign/SignInScene.java:252-255`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/ui/scene/sign/SignInScene.java#L252-L255) |
| 自动探测 / 回退 | 没有 | — |

### 随设置切换的

| 内容 | E | EX | 证据 |
|---|---|---|---|
| 列表、详情、单页、收藏、watched、mytags、uconfig、popular、archiver、gallerypopups | `https://e-hentai.org/...` | `https://exhentai.org/...` | [`client/EhUrl.java:92-100`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L92-L100) |
| `api.php` | `https://e-hentai.org/api.php` | `https://exhentai.org/api.php` | [`client/EhUrl.java:51-52`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L51-L52) |
| Referer / Origin | `https://e-hentai.org` | `https://exhentai.org` | [`client/EhUrl.java:136-154`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L136-L154) |
| 以图搜图 | `https://upld.e-hentai.org/image_lookup.php` | `https://upld.exhentai.org/upld/image_lookup.php` | [`client/EhUrl.java:63-64`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L63-L64) |
| archiver 页面解析用的 DOM 下标 | `child(2)` 余额、`child(3)` 表单 | `child(0)`、`child(1)` | [`client/parser/ArchiveParser.java:64-95`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/parser/ArchiveParser.java#L64-L95) |

### 不随设置切换的

| 内容 | 固定为 | 证据 |
|---|---|---|
| `home.php`（限额） | `https://e-hentai.org/home.php` | [`client/EhUrl.java:102-104`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L102-L104) |
| `toplist.php` | `https://e-hentai.org/toplist.php`（EX 分支被注释掉了） | [`client/EhUrl.java:233-247`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L233-L247) |
| `news.php` | `https://e-hentai.org/news.php` | [`client/EhUrl.java:49`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L49) |
| 登录、个人资料 | `forums.e-hentai.org` | [`client/EhUrl.java:47`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L47) |
| 缩略图主机 | `https://ehgt.org/`；EX 的 `exhentai.org/t/` 分支被注释掉了 | [`client/EhUrl.java:280-288`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrl.java#L280-L288) |

列表和收藏的每一条结果，缩略图都会被无条件改写到 `ehgt.org`（[`client/EhEngine.java:257-259`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L257-L259)），所以 EX 模式下的列表缩略图也从 `ehgt.org` 取。【代码】

用户点开一个 `exhentai.org/g/...` 链接、而设置是 E 时，客户端只取 gid 和 token，然后去 e-hentai.org 请求（[`client/EhUrlOpener.kt:52-58`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhUrlOpener.kt#L52-L58)）。【代码】

### 站点相关的错误识别

客户端不探测站点，只在出错时识别三种情况：

| 情况 | 判定方式 | 结果 | 证据 |
|---|---|---|---|
| Sad Panda | 响应头同时满足 `Content-Disposition: inline; filename="sadpanda.jpg"`、`Content-Type: image/gif`、`Content-Length: 9615` | `EhException("Sad Panda")` | [`client/EhEngine.java:99-101`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L99-L101) |
| kokomade | 响应体含 `https://exhentai.org/img/kokomade.jpg` | 提示切回 e-hentai | [`client/EhEngine.java:103`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L103) |
| igneous 不对 | 请求 URL 恰好是 `https://exhentai.org/`，200，且响应体为空 | 列表页显示 "Wrong igneous" | [`client/EhEngine.java:293-295`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhEngine.java#L293-L295) |

这三项判定只在 `EhEngine` 的错误路径里跑。列表解析器会吞掉一切异常（见[请求清单](Request-Inventory.md)），所以列表请求遇到 sad panda 时，用户看到的是「空列表」，不是错误提示。【推断，来自控制流，未实测】

## 2. 域名解析链（`EhHosts`）

`EhHosts.lookup` 依次尝试下面四步，命中即返回，每一步都会把结果打乱顺序（[`client/EhHosts.java:139-171`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhHosts.java#L139-L171)）：

1. 用户 hosts 表 `hosts.db`：每个域名一个 IP，在设置里编辑（[`Hosts.java:49-57`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/Hosts.java#L49-L57)）。
2. 内置 IP 表：`built_in_hosts` 或 `built_ex_hosts` 开着就查，两个都默认开（[`Settings.java:1223-1243`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/Settings.java#L1223-L1243)）。
3. DoH：`dns_over_https` 开着才查，默认关；端点 `https://77.88.8.1/dns-query`，用 POST（[`client/EhHosts.java:124-127`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhHosts.java#L124-L127)）。
4. 系统 DNS。

内置表在类加载时按当时的开关生成一次（[`client/EhHosts.java:51-117`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhHosts.java#L51-L117)），之后的查询每次都重新判断开关。所以运行中改开关，要等重启才完全生效。【代码 + 推断】

### 内置 IP 表

原样摘自 [`client/EhHosts.java:53-113`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhHosts.java#L53-L113)。这些 IP 是写死的常量，没有任何更新机制，现在是否还有效不知道。

```
# 组 E（built_in_hosts）
e-hentai.org:               104.20.18.168, 104.20.19.168, 172.66.132.196, 172.66.140.62, 104.20.18.168, 172.67.2.238
repo.e-hentai.org:          104.20.18.168, 104.20.19.168, 172.67.2.238
forums.e-hentai.org:        172.66.132.196, 172.66.140.62
upld.e-hentai.org:          89.149.221.236, 95.211.208.236
ehgt.org:                   109.236.85.28, 62.112.8.21, 89.39.106.43,
                            2a00:7c80:0:123::3a85, 2a00:7c80:0:12d::38a1, 2a00:7c80:0:13b::37a4
raw.githubusercontent.com:  151.101.0.133, 151.101.64.133, 151.101.128.133, 151.101.192.133
# 组 EX（built_ex_hosts）
exhentai.org:               178.175.128.251-254, 178.175.129.251-254, 178.175.132.19-22
upld.exhentai.org:          178.175.132.22, 178.175.129.254, 178.175.128.254
s.exhentai.org:             178.175.129.253-254, 178.175.128.253-254, 178.175.132.21-22
```

- `104.20.18.168` 在 e-hentai.org 的列表里出现了两次，被选中的概率翻倍（[`client/EhHosts.java:55`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhHosts.java#L55)、[`client/EhHosts.java:59`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhHosts.java#L59)）。【代码】
- `repo.e-hentai.org` 和 `s.exhentai.org` 在代码里没有任何别的引用，只出现在这张表里。【代码】
- 104.20.x、172.66.x、172.67.x 像是 Cloudflare 的地址段。【推断，公开常识，未在仓库内验证】

## 3. 域前置（不发 SNI）

| 项 | 事实 | 证据 |
|---|---|---|
| 开关 | `domain_fronting`，默认开 | [`Settings.java:1377-1387`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/Settings.java#L1377-L1387) |
| 生效条件 | `Settings.getDF() && AppHelper.checkVPN(context)` | [`EhApplication.java:429`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/EhApplication.java#L429) |
| `checkVPN` 的语义 | 返回 `!isVpn`，即**没检测到 VPN 时**才走域前置；检测到 VPN 时弹一个提示 | [`com/hippo/util/AppHelper.kt:139-147`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/util/AppHelper.kt#L139-L147) |
| 做法 | 自定义 `SSLSocketFactory` 丢掉主机名，用已连接 socket 的 IP 重新建 TLS socket | [`com/hippo/network/EhSSLSocketFactory.java:36-49`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/network/EhSSLSocketFactory.java#L36-L49) |
| SDK < 29 | 额外插入 Conscrypt 并限制为 `MODERN_TLS` | [`EhApplication.java:430-445`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/EhApplication.java#L430-L445) |

- 主机名到不了 TLS 层，所以 ClientHello 大概率不带 `server_name`。这正是设置里写的「绕过 SNI 封锁」。【推断；OkHttp 可能在建连后补设主机名，需要抓包确认】
- 这个决定在 OkHttpClient 首次构建时做一次，进程内不再变。【推断】
- 域前置和 HTTP 代理一起用时，`s.getInetAddress()` 拿到的是代理的地址，会被当成目标重新拨号。【推断，没有防护代码】
- 代码注释说 `getNetworkInfo` 在某些设备上「总是返回 null」（[`com/hippo/util/AppHelper.kt:137`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/util/AppHelper.kt#L137)），这样就永远检测不到 VPN，域前置一直开着。【推断】

## 4. TLS 与证书

- 信任系统 CA 和用户安装的 CA（[`res/xml/network_security_config.xml:19-24`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/res/xml/network_security_config.xml#L19-L24)），所以设备上装的抓包证书会被 app 接受。【代码 + 推断】
- 只有 `ehtracker.org` 允许明文 HTTP（[`res/xml/network_security_config.xml:25-27`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/res/xml/network_security_config.xml#L25-L27)）。
- 没有证书固定，没有自定义 `HostnameVerifier`。代码里有一个「全部信任」的 `EhX509TrustManager`，只在异常分支里作为参数传进 `sslSocketFactory(...)`，从没放进 `SSLContext`（[`EhApplication.java:448`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/EhApplication.java#L448)）。【代码】

## 5. 代理

| 项 | 事实 | 证据 |
|---|---|---|
| 类型 | 0 直连、1 系统（默认）、2 HTTP、3 SOCKS | [`EhProxySelector.java:34-37`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/EhProxySelector.java#L34-L37) |
| 设置项 | `proxy_type`、`proxy_ip`、`proxy_port` | [`Settings.java:1258-1289`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/Settings.java#L1258-L1289) |
| 认证 | 不支持 | — |
| 范围 | 两个 OkHttpClient 都用 | [`EhApplication.java:428`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/EhApplication.java#L428) |

用 SOCKS 代理时由代理解析目标域名，上面的 hosts 表和 DoH 对目标站不起作用。【推断，OkHttp 3.x 行为】

## 6. 请求头

所有经 `EhRequestBuilder` 发出的请求，都带下面这组固定头（[`com/hippo/okhttp/ChromeRequestBuilder.java:45-62`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/okhttp/ChromeRequestBuilder.java#L45-L62)）：

| 头 | 值 |
|---|---|
| `Host` | URL 里的主机部分，取自 `url.split("/")[2]` |
| `User-Agent` | `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36` |
| `Accept` | `image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8`，HTML 和 JSON 请求也是这个值 |
| `Accept-Language` | `zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7`，与 app 语言无关 |

- `Accept-Encoding`、`Sec-Fetch-*`、`sec-ch-ua*` 都被注释掉了（[`com/hippo/okhttp/ChromeRequestBuilder.java:61`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/okhttp/ChromeRequestBuilder.java#L61)）。OkHttp 自己会补 `Accept-Encoding: gzip`、`Connection`、`Cookie`。【推断】
- `Referer`、`Origin` 由每个调用点单独决定（[`client/EhRequestBuilder.java:36-44`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/client/EhRequestBuilder.java#L36-L44)）。大致规律：GET 带 Referer，POST 再加 Origin。逐个调用见[请求清单](Request-Inventory.md)。
- 缩略图（[`com/hippo/conaco/ConacoTask.java:357`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/conaco/ConacoTask.java#L357)）、种子文件、归档 zip 这几类请求用的是裸 `Request.Builder`，不带上面这组头，UA 会是 OkHttp 默认值。【代码 + 推断】
- `url.split("/")[2]` 要求 URL 必须是绝对地址。站点返回的相对 `href` 或相对 `Location` 会让它直接抛异常。【代码 + 推断】

## 7. 两个 OkHttpClient

| | 主 client（[`EhApplication.java:376-471`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/EhApplication.java#L376-L471)） | 图片 client（[`EhApplication.java:474-537`](https://github.com/HicirTech/Ehviewer-Lab/blob/16e019db1b4572a6474bede5d140106d38b5021b/app/src/main/java/com/hippo/ehviewer/EhApplication.java#L474-L537)） |
|---|---|---|
| 用途 | 几乎所有请求，包括图片本体下载和缩略图 | 只用于以图搜图，以及原图跳转（读 302 的 `Location`） |
| 重定向 | 跟随 | 不跟随 |
| 连接 / 读 / 写超时 | 各 10 s | 各 20 s |
| 整体超时 | 无 | 20 s |
| 连接池 | 10 个空闲，5 分钟 | 默认 |
| Cookie | `EhCookieStore` | 同一个 |
| HTTP 缓存 | 共用一个 50 MB 缓存 | 同一个 |
| 额外拦截器 | 把每个 `Set-Cookie` 同步进 WebView 的 `CookieManager` | 无 |
