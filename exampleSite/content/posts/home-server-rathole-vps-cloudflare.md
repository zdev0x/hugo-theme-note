---
title: "没有公网 IPv4，也能把网站放在家里：rathole + 搬瓦工 VPS + Cloudflare 实战"
date: "2026-11-16T04:19:47+08:00"
draft: false
categories: ["家庭网络"]
tags: ["Caddy", "Cloudflare", "Docker", "PVE", "rathole", "WordPress"]
description: "以家庭 PVE 虚拟机和 WordPress 为例，记录如何通过 rathole、搬瓦工 VPS、Caddy 与 Cloudflare，把家庭网络中的网站安全地发布到公网。"
---
我有一台长期运行的家庭服务器，也有一台带公网 IP 的搬瓦工 VPS。家庭服务器适合跑应用和保存数据，但家庭宽带通常没有公网 IPv4，或者不方便在路由器上做端口映射；VPS 有公网入口，但配置、存储和带宽成本又未必适合承载所有服务。

我最后采用的方式是：**网站和数据库运行在家庭服务器上，rathole 建立加密隧道，搬瓦工 VPS 上的 Caddy 作为统一入口，域名交给 Cloudflare 解析和代理。**

这套方案不需要家庭宽带拥有公网 IPv4，也不需要把路由器的某个端口直接暴露到互联网。家庭服务器只要能够主动连接 VPS，就可以向访客提供网站。

> 本文以 `dahai.me` 和家庭服务器 `pve-service` 为例。公网 IP、密钥和访问令牌均使用占位符，实际部署时请替换成自己的值。

## 一、整体访问链路

完整的请求路径如下：

```text
访客
  │
  ▼
Cloudflare
  │  DNS 解析、CDN 代理、TLS 终止
  ▼
搬瓦工 VPS 的公网 IP
  │
  ▼
Caddy :443
  │  按域名反向代理
  ▼
rathole 服务端：127.0.0.1:12005
  │
  │  家庭服务器主动建立的 Noise 加密隧道
  │  VPS :25100 ← 家庭服务器出站连接
  ▼
rathole 客户端：pve-service
  │
  ▼
家庭 Nginx：127.0.0.1:12005
  │
  ▼
WordPress / PHP-FPM
  │
  ├── MariaDB
  └── Redis
```

这里最容易混淆的是：**两端的 `12005` 并不是同一个监听 socket。**

-   VPS 上的 `127.0.0.1:12005` 由 rathole 服务端监听，供 Caddy 访问。
-   家庭服务器上的 `127.0.0.1:12005` 由网站 Nginx 容器映射，供 rathole 客户端访问。
-   rathole 负责把这两个端点连接起来。

使用相同的端口号只是为了让配置更容易理解，并不是强制要求。

## 二、我的运行环境

这套部署使用的主要组件如下：

| 位置 | 组件 | 用途 |
| --- | --- | --- |
| 家庭 PVE 中的虚拟机 `pve-service` | Debian 13、Docker、Docker Compose | 运行网站及其依赖 |
| 家庭服务器 | rathole 0.5.0 | 主动连接 VPS 并转发本地服务 |
| 搬瓦工 VPS | Debian 12、Caddy 2.11 | 公网 HTTPS 入口与反向代理 |
| 搬瓦工 VPS | rathole 0.5.0 | 接受家庭服务器的隧道连接 |
| Cloudflare | DNS 与 CDN 代理 | 域名解析、边缘 TLS 和缓存 |
| Docker 容器 | Nginx、PHP 8.5、MariaDB 11.4、Redis 7.4 | 运行 WordPress |

rathole 服务端和客户端的版本最好保持一致，至少应先确认双方使用的配置格式和传输协议兼容。

## 三、先把网站跑在家庭服务器上

我把 WordPress 的 Compose 项目放在：

```text
/opt/docker/blog/
├── docker-compose.yml
├── Dockerfile
├── .env
├── nginx/
├── php/
└── www/
```

其中：

-   `www` 保存 WordPress 程序、主题、插件和上传文件。
-   MariaDB 使用命名卷保存数据库。
-   Nginx 负责处理 HTTP 请求，再把 PHP 请求交给 PHP-FPM。
-   MariaDB 和 Redis 不映射宿主机端口，只允许 Compose 内部网络访问。

Nginx 服务最关键的端口配置是：

```yaml
services:
  nginx:
    image: nginx:stable-alpine
    container_name: blog-nginx
    restart: unless-stopped
    ports:
      - "127.0.0.1:12005:80"
    volumes:
      - ./www:/var/www/html
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    networks:
      - blog

networks:
  blog:
    driver: bridge
```

这里特意使用 `127.0.0.1:12005:80`，而不是 `12005:80`。后者可能监听所有宿主机网卡，前者则只允许家庭服务器本机访问，从而减少意外暴露。

启动项目：

```bash
cd /opt/docker/blog
docker compose up -d --build
docker compose ps
```

先绕过隧道和公网域名，在家庭服务器本机验证：

```bash
curl -I http://127.0.0.1:12005
```

如果这里就无法访问，应该先检查容器、Nginx、PHP 或数据库，而不是急着排查 Cloudflare。

## 四、用 rathole 建立家庭到 VPS 的加密隧道

rathole 的服务端和客户端由配置文件自动识别，不需要编译成两个不同程序。

### 1\. 生成 Noise 密钥和独立服务令牌

执行以下命令生成用于 Noise 协议的密钥对：

```bash
rathole --genkey x25519
```

命令会输出一对公钥和私钥：

-   `local_private_key` 放在 VPS 的服务端配置中。
-   `remote_public_key` 放在家庭服务器的客户端配置中。

再为博客服务生成一个独立、足够长的随机令牌：

```bash
openssl rand -hex 32
```

服务端和客户端的同一个服务必须使用相同令牌；不同服务不要共用令牌。

### 2\. 配置搬瓦工 VPS 上的 rathole 服务端

配置文件为 `/etc/rathole/server.toml`：

```toml
[server]
bind_addr = "0.0.0.0:25100"

[server.transport]
type = "noise"

[server.transport.noise]
local_private_key = "<RATHOLE_SERVER_PRIVATE_KEY>"

[server.services.pve-service-blog]
type = "tcp"
bind_addr = "127.0.0.1:12005"
token = "<BLOG_SERVICE_TOKEN>"
```

`25100` 是家庭服务器连接 VPS 的隧道端口，因此 VPS 的防火墙需要允许该端口的入站连接。

`12005` 则绑定在 `127.0.0.1`，只允许 VPS 本机的 Caddy 使用，不直接暴露到公网。

### 3\. 配置家庭服务器上的 rathole 客户端

配置文件为 `/etc/rathole/client-us.toml`：

```toml
[client]
remote_addr = "<BWG_VPS_IP>:25100"

[client.transport]
type = "noise"

[client.transport.noise]
remote_public_key = "<RATHOLE_SERVER_PUBLIC_KEY>"

[client.services.pve-service-blog]
type = "tcp"
local_addr = "127.0.0.1:12005"
token = "<BLOG_SERVICE_TOKEN>"
```

这里有三个对应关系：

-   `remote_addr` 必须指向 VPS 的 rathole 监听地址。
-   服务名 `pve-service-blog` 必须在两端一致。
-   `local_addr` 必须指向家庭服务器上真正运行的网站端口。

### 4\. 使用 systemd 保持隧道运行

VPS 上的 `/etc/systemd/system/rathole.service`：

```ini
[Unit]
Description=Rathole Server
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/rathole /etc/rathole/server.toml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

家庭服务器上的单元名为 `rathole-us.service`，主要区别是启动配置：

```ini
ExecStart=/usr/local/bin/rathole /etc/rathole/client-us.toml
```

分别启动并设置开机自启：

```bash
# 搬瓦工 VPS
systemctl enable --now rathole.service

# 家庭服务器
systemctl enable --now rathole-us.service
```

检查状态和日志：

```bash
systemctl status rathole.service --no-pager
journalctl -u rathole.service -n 50 --no-pager

systemctl status rathole-us.service --no-pager
journalctl -u rathole-us.service -n 50 --no-pager
```

隧道正常后，在 VPS 本机执行：

```bash
curl -I http://127.0.0.1:12005
```

此时家庭网站尚未配置公网域名。如果家庭服务器本机访问正常，而 VPS 上这条命令失败，问题基本就在 rathole、令牌、Noise 密钥或 VPS 的 `25100` 端口。

## 五、让 Cloudflare 把域名带到搬瓦工 VPS

在 Cloudflare 的 DNS 中添加记录：

| 类型 | 名称 | 内容 | 代理状态 |
| --- | --- | --- | --- |
| A | `@` | `<BWG_VPS_IP>` | 已代理（橙色云朵） |

如果还需要 `www`，可以再增加一条 `CNAME` 记录指向主域名。

开启橙色云朵后，查询域名得到的通常是 Cloudflare 的边缘 IP，而不是 VPS 的真实 IP，这是正常现象。

SSL/TLS 模式建议使用 **Full (strict)**，并确保 VPS 上的 Caddy 能为主域名提供有效证书。不要随意使用 Flexible，否则 Cloudflare 到源站之间仍是 HTTP，也容易引入重定向问题。

VPS 防火墙需要允许：

-   TCP `80`：HTTP 和证书签发相关流量。
-   TCP `443`：HTTPS 入口。
-   UDP `443`：如需 HTTP/3。
-   TCP `25100`：家庭 rathole 客户端连接。

## 六、使用 Caddy 按域名反向代理

VPS 上 `/etc/caddy/Caddyfile` 中，博客站点的核心配置为：

```caddyfile
dahai.me {
    reverse_proxy 127.0.0.1:12005 {
        header_up X-Real-IP {client_ip}
        header_up X-Forwarded-For {client_ip}
        header_up X-Forwarded-Proto https
    }
}
```

Caddy 会根据 Host 把 `dahai.me` 的请求转给 VPS 本机的 rathole 服务端口，再由隧道送回家庭服务器。

修改后先检查，再 reload：

```bash
caddy fmt --overwrite /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
systemctl status caddy --no-pager
```

如果同一台 VPS 还发布其他家庭服务，可以继续增加独立域名和独立端口。例如：

```caddyfile
webdav.example.com {
    reverse_proxy 127.0.0.1:12004
}
```

相应的 rathole 服务端和客户端也要增加同名服务，并为它使用单独令牌。

## 七、正确传递真实访客 IP

启用 Cloudflare 代理后，源站直接看到的连接方是 Cloudflare，而不是访客。如果只记录网络对端地址，日志里会充满 Cloudflare 的 IP。

我的处理顺序是：

1.  Caddy 只信任 Cloudflare 官方公布的 IP 网段。
2.  从这些可信代理请求中读取 `CF-Connecting-IP`。
3.  Caddy 将得到的客户端地址写入 `X-Real-IP` 和 `X-Forwarded-For`。
4.  家庭 Nginx 只信任自己的 Docker 网关，并读取 `X-Real-IP`。

Caddy 的全局配置中可使用 `trusted_proxies`、`trusted_proxies_strict` 和 `client_ip_headers`。Cloudflare 的网段可能变化，应以官方列表为准：

-   [https://www.cloudflare.com/ips-v4/](https://www.cloudflare.com/ips-v4/)
-   [https://www.cloudflare.com/ips-v6/](https://www.cloudflare.com/ips-v6/)

家庭 Nginx 中的关键配置示例：

```nginx
# 示例地址，必须替换成实际 Docker 网络中可信的网关或网段
set_real_ip_from 172.22.0.1;
real_ip_header X-Real-IP;
real_ip_recursive off;
```

不要不加判断地复制 `172.22.0.1`。Docker 重建网络后，网关可能变化；更稳妥的方式是为 Compose 网络规划固定子网，或者根据实际网络配置可信来源。

WordPress 还应使用正确的站点地址，例如 `https://dahai.me`。如果出现混合内容或后台协议判断异常，可以检查 Nginx 是否继续向后传递 `X-Forwarded-Proto`，以及 WordPress 是否正确识别代理后的 HTTPS。

## 八、按层次验证，避免盲目排障

我通常按照下面的顺序测试：

```bash
# 1. 家庭服务器：验证 WordPress 本机入口
curl -I http://127.0.0.1:12005

# 2. 搬瓦工 VPS：验证 rathole 已把家庭服务带过来
curl -I http://127.0.0.1:12005

# 3. 搬瓦工 VPS：验证 Caddy 配置
caddy validate --config /etc/caddy/Caddyfile

# 4. 任意外部网络：验证完整公网链路
curl -I https://dahai.me
```

不同现象对应不同层面：

| 现象 | 优先检查 |
| --- | --- |
| 家庭服务器本机无法访问 `12005` | Docker 容器、Nginx、PHP、MariaDB |
| 家庭本机正常，VPS 的 `12005` 失败 | rathole 服务名、令牌、Noise 密钥、`25100` 防火墙 |
| VPS 隧道入口正常，公网返回 `502` | Caddy upstream 是否指向正确端口 |
| Cloudflare 返回 `521` 或 `522` | VPS 的 Caddy、80/443 防火墙、Cloudflare 到源站网络 |
| 出现重定向循环或混合内容 | Cloudflare SSL/TLS 模式、WordPress 地址、HTTPS 请求头 |
| 日志中的访客 IP 不正确 | Cloudflare 可信代理、Caddy 请求头、Nginx `set_real_ip_from` |

最后还要实际测试：

-   首页和固定链接是否正常。
-   WordPress 后台能否登录和保存文章。
-   图片上传是否正常，上传大小是否超过 Nginx/PHP 限制。
-   主题、插件和缓存是否正常工作。
-   家庭宽带断开或 VPS 重启后，rathole 能否自动恢复。

## 九、安全边界比“能访问”更重要

这套方案中，我特别注意以下几点：

-   网站端口只绑定家庭服务器的 `127.0.0.1`。
-   VPS 的 rathole 服务端口也只绑定 `127.0.0.1`，不让访客绕过 Caddy。
-   数据库和 Redis 不映射宿主机端口。
-   每个 rathole 服务使用独立随机令牌。
-   Noise 私钥、服务令牌和 `.env` 不提交到 Git，也不出现在公开文章里。
-   Caddy、rathole 和 Docker 容器均配置自动重启与健康检查。
-   定期备份 WordPress 文件、数据库和关键配置，并验证备份能否恢复。
-   不把 Cloudflare 代理当成访问控制；后台登录、更新和强密码仍然不可省略。

如果域名全部经过 Cloudflare，还可以评估是否只让 Cloudflare 官方网段访问源站的 80/443。实施前需要确认 VPS 上是否还有必须直接访问的服务，避免误伤。

## 十、一个容易忽略的坑：配置存在，不代表流量正在使用

rathole 中保留了某个服务，并不意味着线上域名一定走这条隧道。真正的公网出口要看 Caddy 当前生效的 upstream。

例如：

```caddyfile
# 网站在家庭服务器：流量经过 rathole
reverse_proxy 127.0.0.1:12005

# 网站在 VPS 本机：流量不经过家庭服务器
reverse_proxy 127.0.0.1:8080
```

这两种部署可以在迁移或故障时互相切换，但切换前应同步 WordPress 文件、数据库、缓存和密钥，并做好备份。判断当前架构时，应同时检查 DNS、Caddy、实际监听端口和容器状态，而不能只看某一份遗留配置。

## 总结

这套方案把不同机器的优势组合在了一起：

-   **家庭服务器**提供计算、存储和完整的应用控制权。
-   **rathole**解决家庭网络没有公网入口的问题，并提供加密传输。
-   **搬瓦工 VPS + Caddy**提供稳定的公网入口、自动 HTTPS 和统一反向代理。
-   **Cloudflare**提供 DNS、边缘 TLS、缓存和额外的网络防护。

它的代价是需要自己维护 VPS、隧道、密钥和多层配置。但只要把每一层的职责划分清楚，并按照“家庭本机 → VPS 隧道入口 → Caddy → Cloudflare”的顺序验证，部署和排障都不算复杂。

对我来说，更重要的是这套结构足够灵活：网站可以留在家里，也可以在需要时迁移到 VPS；新增一个家庭 Web 服务，通常只需要增加一个 rathole 服务、一个内部端口和一条 Caddy 站点配置。
