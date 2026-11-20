---
title: "Docker + Caddy 部署 WordPress 实战"
date: "2026-11-16T09:42:51+08:00"
draft: false
categories: ["家庭网络"]
tags: ["Caddy", "Docker", "MariaDB", "Nginx", "PHP-FPM", "WordPress"]
description: "按搬瓦工真实部署模式整理：宿主机 Caddy、Docker Nginx、PHP-FPM、MariaDB、Redis，以及 /opt/docker/blog 的完整配置和一键安装脚本。"
---
这篇文章按我当前的搬瓦工 VPS 部署整理：**Caddy 运行在宿主机，Nginx、PHP-FPM、MariaDB 与 Redis 运行在 Docker 容器中。**

它不是「Caddy 容器 + WordPress 官方 Apache 镜像」的简化版；文中的目录、镜像、端口与配置都和下载包中的安装脚本一致。

## 一、实际访问链路

```text
访客
  ↓
Cloudflare
  ↓ HTTPS
搬瓦工 VPS 宿主机 Caddy :443
  ↓ 反向代理到宿主机回环地址
127.0.0.1:8080（Docker Nginx 容器）
  ↓ FastCGI
PHP-FPM :9000（Docker PHP 容器）
  ↓
MariaDB / Redis（仅 Docker 内部网络）
```

这套结构有几个明确边界：

- 只有宿主机 Caddy 对公网开放 80/443。
- Nginx 只监听宿主机 `127.0.0.1:8080`。
- PHP-FPM、MariaDB 和 Redis 不向宿主机或公网映射端口。
- WordPress 文件直接放在 `/opt/docker/blog/www/`，不会出现额外的 WordPress 目录层级。

## 二、完整目录结构

```text
/opt/docker/blog/
├── .env                         # 数据库密码、WordPress 密钥和部署参数
├── .bwg-wordpress-oneclick      # 安装实例标记
├── docker-compose.yml           # 四个容器及网络、资源限制、健康检查
├── Dockerfile                   # 自定义 PHP-FPM 镜像
├── nginx/
│   ├── nginx.conf               # Nginx 主配置
│   ├── default.conf             # WordPress 站点、FastCGI、真实 IP、安全规则
│   └── logs/                    # Nginx 日志
├── php/
│   ├── conf.d/
│   │   └── 99-blog.ini          # PHP 与 OPcache 配置
│   └── php-fpm.d/
│       └── zz-blog.ini          # PHP-FPM 进程配置
└── www/                         # WordPress 根目录
    ├── index.php
    ├── wp-config.php
    ├── wp-admin/
    ├── wp-content/
    └── wp-includes/
```

`php/php-fpm.d/zz-blog.ini` 在 Compose 中挂载为容器内的 `zz-blog.conf`，这样 PHP-FPM 才会按 `.conf` 后缀加载它。

## 三、关键配置文件全文

### 1. `.env.example`

真实 `.env` 不公开。安装脚本会把占位符替换为域名、端口、项目名和随机生成的密码。

```dotenv
DOMAIN=__DOMAIN__
PUBLIC_HTTPS_ORIGIN=__PUBLIC_HTTPS_ORIGIN__
COMPOSE_PROJECT_NAME=__COMPOSE_PROJECT_NAME__
BLOG_PORT=__BLOG_PORT__
HTTP_PORT=__HTTP_PORT__
HTTPS_PORT=__HTTPS_PORT__
BLOG_SUBNET=__BLOG_SUBNET__
BLOG_GATEWAY=__BLOG_GATEWAY__

MARIADB_DATABASE=wordpress
MARIADB_USER=wordpress
MARIADB_PASSWORD=__MARIADB_PASSWORD__
MARIADB_ROOT_PASSWORD=__MARIADB_ROOT_PASSWORD__

WORDPRESS_AUTH_KEY=__WORDPRESS_AUTH_KEY__
WORDPRESS_SECURE_AUTH_KEY=__WORDPRESS_SECURE_AUTH_KEY__
WORDPRESS_LOGGED_IN_KEY=__WORDPRESS_LOGGED_IN_KEY__
WORDPRESS_NONCE_KEY=__WORDPRESS_NONCE_KEY__
WORDPRESS_AUTH_SALT=__WORDPRESS_AUTH_SALT__
WORDPRESS_SECURE_AUTH_SALT=__WORDPRESS_SECURE_AUTH_SALT__
WORDPRESS_LOGGED_IN_SALT=__WORDPRESS_LOGGED_IN_SALT__
WORDPRESS_NONCE_SALT=__WORDPRESS_NONCE_SALT__
```

### 2. `docker-compose.yml`

四个容器共享 `blog` 网络。Nginx 只映射回环端口，MariaDB 和 Redis 不映射宿主机端口。

```yaml
services:
  nginx:
    image: ${NGINX_IMAGE:-nginx:stable-alpine}
    container_name: ${COMPOSE_PROJECT_NAME:-blog}-nginx
    restart: unless-stopped
    ports:
      - "127.0.0.1:${BLOG_PORT:-8080}:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
      - ./nginx/logs:/var/log/nginx
      - ./www:/var/www/html
    depends_on:
      php:
        condition: service_healthy
    networks:
      - blog
    security_opt:
      - no-new-privileges:true
    pids_limit: 100
    mem_limit: 64m
    healthcheck:
      test: ["CMD", "nginx", "-t"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    environment:
      TZ: Asia/Shanghai

  php:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        PHP_BASE_IMAGE: ${PHP_BASE_IMAGE:-php:8.5-fpm}
    image: ${COMPOSE_PROJECT_NAME:-blog}-php:8.5
    container_name: ${COMPOSE_PROJECT_NAME:-blog}-php
    restart: unless-stopped
    working_dir: /var/www/html
    environment:
      TZ: Asia/Shanghai
      DOMAIN: ${DOMAIN:?Set DOMAIN}
      PUBLIC_HTTPS_ORIGIN: ${PUBLIC_HTTPS_ORIGIN:?Set PUBLIC_HTTPS_ORIGIN}
      WORDPRESS_DB_HOST: db:3306
      WORDPRESS_DB_NAME: ${MARIADB_DATABASE:?Set MARIADB_DATABASE}
      WORDPRESS_DB_USER: ${MARIADB_USER:?Set MARIADB_USER}
      WORDPRESS_DB_PASSWORD: ${MARIADB_PASSWORD:?Set MARIADB_PASSWORD}
      WORDPRESS_AUTH_KEY: ${WORDPRESS_AUTH_KEY:?Set WORDPRESS_AUTH_KEY}
      WORDPRESS_SECURE_AUTH_KEY: ${WORDPRESS_SECURE_AUTH_KEY:?Set WORDPRESS_SECURE_AUTH_KEY}
      WORDPRESS_LOGGED_IN_KEY: ${WORDPRESS_LOGGED_IN_KEY:?Set WORDPRESS_LOGGED_IN_KEY}
      WORDPRESS_NONCE_KEY: ${WORDPRESS_NONCE_KEY:?Set WORDPRESS_NONCE_KEY}
      WORDPRESS_AUTH_SALT: ${WORDPRESS_AUTH_SALT:?Set WORDPRESS_AUTH_SALT}
      WORDPRESS_SECURE_AUTH_SALT: ${WORDPRESS_SECURE_AUTH_SALT:?Set WORDPRESS_SECURE_AUTH_SALT}
      WORDPRESS_LOGGED_IN_SALT: ${WORDPRESS_LOGGED_IN_SALT:?Set WORDPRESS_LOGGED_IN_SALT}
      WORDPRESS_NONCE_SALT: ${WORDPRESS_NONCE_SALT:?Set WORDPRESS_NONCE_SALT}
    volumes:
      - ./www:/var/www/html
      - ./php/conf.d/99-blog.ini:/usr/local/etc/php/conf.d/99-blog.ini:ro
      - ./php/php-fpm.d/zz-blog.ini:/usr/local/etc/php-fpm.d/zz-blog.conf:ro
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - blog
    security_opt:
      - no-new-privileges:true
    pids_limit: 100
    mem_limit: 512m
    healthcheck:
      test: ["CMD", "php-fpm", "-t"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s

  db:
    image: ${MARIADB_IMAGE:-mariadb:11.4}
    container_name: ${COMPOSE_PROJECT_NAME:-blog}-db
    restart: unless-stopped
    environment:
      TZ: Asia/Shanghai
      MARIADB_DATABASE: ${MARIADB_DATABASE:?Set MARIADB_DATABASE}
      MARIADB_USER: ${MARIADB_USER:?Set MARIADB_USER}
      MARIADB_PASSWORD: ${MARIADB_PASSWORD:?Set MARIADB_PASSWORD}
      MARIADB_ROOT_PASSWORD: ${MARIADB_ROOT_PASSWORD:?Set MARIADB_ROOT_PASSWORD}
    volumes:
      - db-data:/var/lib/mysql
    command:
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
      - --innodb-buffer-pool-size=256M
      - --max-connections=30
    networks:
      - blog
    security_opt:
      - no-new-privileges:true
    pids_limit: 200
    mem_limit: 640m
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s

  redis:
    image: ${REDIS_IMAGE:-redis:7.4-alpine}
    container_name: ${COMPOSE_PROJECT_NAME:-blog}-redis
    restart: unless-stopped
    command:
      - redis-server
      - --save
      - ""
      - --appendonly
      - "no"
      - --maxmemory
      - 64mb
      - --maxmemory-policy
      - allkeys-lru
    networks:
      - blog
    security_opt:
      - no-new-privileges:true
    pids_limit: 50
    mem_limit: 96m
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

networks:
  blog:
    driver: bridge
    ipam:
      config:
        - subnet: ${BLOG_SUBNET:-172.19.0.0/24}
          gateway: ${BLOG_GATEWAY:-172.19.0.1}

volumes:
  db-data:
    name: ${COMPOSE_PROJECT_NAME:-blog}-db-data
```

### 3. `Dockerfile`

PHP 镜像包含 WordPress 常用的 MySQL、GD、EXIF、ZIP、Intl、BCMath 和 Redis 扩展。

```dockerfile
ARG PHP_BASE_IMAGE=php:8.5-fpm
FROM ${PHP_BASE_IMAGE}

ENV TZ=Asia/Shanghai

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        $PHPIZE_DEPS \
        libfreetype6-dev \
        libjpeg62-turbo-dev \
        libpng-dev \
        libwebp-dev \
        libicu-dev \
        libzip-dev \
        ca-certificates \
    && docker-php-ext-configure gd \
        --with-freetype \
        --with-jpeg \
        --with-webp \
    && docker-php-ext-install -j"$(nproc)" \
        mysqli \
        pdo_mysql \
        exif \
        gd \
        zip \
        intl \
        bcmath \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && runtime_libs="$(dpkg-query -W -f='${binary:Package}\n' \
        'libfreetype6' \
        'libjpeg62-turbo' \
        'libpng16-16*' \
        'libwebp7' \
        'libicu[0-9]*' \
        'libzip[0-9]*' 2>/dev/null || true)" \
    && if [ -n "$runtime_libs" ]; then apt-mark manual $runtime_libs; fi \
    && apt-get purge -y --auto-remove \
        $PHPIZE_DEPS \
        libfreetype6-dev \
        libjpeg62-turbo-dev \
        libpng-dev \
        libwebp-dev \
        libicu-dev \
        libzip-dev \
    && rm -rf /var/lib/apt/lists/* /tmp/pear

WORKDIR /var/www/html

EXPOSE 9000

CMD ["php-fpm"]
```

### 4. `nginx/nginx.conf`

```nginx
user nginx;
worker_processes auto;

error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;

    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;
    access_log off;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 5;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        application/json
        application/javascript
        application/xml
        application/rss+xml
        image/svg+xml;

    include /etc/nginx/conf.d/*.conf;
}
```

### 5. `nginx/default.conf`

这个文件负责 WordPress 固定链接、PHP-FPM、真实访客 IP、静态缓存和敏感文件保护。

```nginx
log_format blog_json escape=json
    '{'
        '"time":"$time_iso8601",'
        '"timestamp":"$msec",'
        '"request_id":"$request_id",'
        '"remote_addr":"$remote_addr",'
        '"realip_remote_addr":"$realip_remote_addr",'
        '"caddy_client_ip":"$http_x_real_ip",'
        '"x_forwarded_for":"$http_x_forwarded_for",'
        '"host":"$host",'
        '"method":"$request_method",'
        '"uri":"$uri",'
        '"protocol":"$server_protocol",'
        '"status":"$status",'
        '"body_bytes_sent":"$body_bytes_sent",'
        '"request_time":"$request_time",'
        '"upstream_response_time":"$upstream_response_time",'
        '"upstream_addr":"$upstream_addr",'
        '"referer":"$http_referer",'
        '"user_agent":"$http_user_agent"'
    '}';

server {
    listen 80;
    server_name _;

    root /var/www/html;
    index index.php index.html;

    charset utf-8;
    client_max_body_size 64m;

    # 只信任 Caddy 的 Docker 网关，由安装脚本替换
    set_real_ip_from __BLOG_GATEWAY__;
    real_ip_header X-Real-IP;
    real_ip_recursive off;

    access_log /var/log/nginx/access.json blog_json;
    error_log /var/log/nginx/error.log warn;

    location / {
        try_files $uri $uri/ /index.php?$args;
    }

    # 禁止上传目录执行 PHP
    location ~* ^/wp-content/uploads/.*\.php$ {
        deny all;
    }

    # 禁止访问敏感文件
    location ~* /(wp-config\.php|wp-config-sample\.php|readme\.html|license\.txt)$ {
        deny all;
    }

    # 禁止访问隐藏文件
    location ~ /\.(?!well-known).* {
        deny all;
    }

    location ~ \.php$ {
        try_files $uri =404;

        include fastcgi_params;

        fastcgi_pass php:9000;
        fastcgi_index index.php;

        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;

        fastcgi_param HTTP_X_FORWARDED_PROTO $http_x_forwarded_proto;
        fastcgi_param HTTP_X_REAL_IP $http_x_real_ip;

        fastcgi_connect_timeout 30s;
        fastcgi_send_timeout 120s;
        fastcgi_read_timeout 120s;
    }

    # 静态资源缓存
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|webp|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        access_log off;
        log_not_found off;
    }
}
```

### 6. `php/conf.d/99-blog.ini`

```ini
; 基础设置
expose_php = Off
display_errors = Off
display_startup_errors = Off
log_errors = On
error_log = /proc/self/fd/2

; 资源限制
memory_limit = 128M
max_execution_time = 120
max_input_time = 120
max_input_vars = 3000

; 文件上传
file_uploads = On
upload_max_filesize = 64M
post_max_size = 64M
max_file_uploads = 20

; 安全
session.upload_progress.enabled = Off
zend.exception_ignore_args = On

; OPcache
opcache.enable = 1
opcache.enable_cli = 0
opcache.memory_consumption = 128
opcache.interned_strings_buffer = 16
opcache.max_accelerated_files = 20000
opcache.validate_timestamps = 1
opcache.revalidate_freq = 2
opcache.save_comments = 1

; 时区
date.timezone = Asia/Shanghai
```

### 7. `php/php-fpm.d/zz-blog.ini`

```ini
[www]

clear_env = no

catch_workers_output = yes
decorate_workers_output = no

security.limit_extensions = .php

; 低内存 VPS 进程管理
pm = ondemand
pm.max_children = 2
pm.process_idle_timeout = 10s
pm.max_requests = 500

; 请求超时
request_terminate_timeout = 120s

; 连接队列
listen.backlog = 128
```

### 8. `www/wp-config.php`

数据库和 WordPress 密钥全部从容器环境变量读取，不直接写进公开文件。

```php
<?php

define('DB_NAME', getenv('WORDPRESS_DB_NAME'));
define('DB_USER', getenv('WORDPRESS_DB_USER'));
define('DB_PASSWORD', getenv('WORDPRESS_DB_PASSWORD'));
define('DB_HOST', getenv('WORDPRESS_DB_HOST'));

define('DB_CHARSET', 'utf8mb4');
define('DB_COLLATE', '');

define('AUTH_KEY', getenv('WORDPRESS_AUTH_KEY'));
define('SECURE_AUTH_KEY', getenv('WORDPRESS_SECURE_AUTH_KEY'));
define('LOGGED_IN_KEY', getenv('WORDPRESS_LOGGED_IN_KEY'));
define('NONCE_KEY', getenv('WORDPRESS_NONCE_KEY'));

define('AUTH_SALT', getenv('WORDPRESS_AUTH_SALT'));
define('SECURE_AUTH_SALT', getenv('WORDPRESS_SECURE_AUTH_SALT'));
define('LOGGED_IN_SALT', getenv('WORDPRESS_LOGGED_IN_SALT'));
define('NONCE_SALT', getenv('WORDPRESS_NONCE_SALT'));

$table_prefix = 'wp_';

$public_origin = getenv('PUBLIC_HTTPS_ORIGIN');
$domain = getenv('DOMAIN');
if ($public_origin) {
    define('WP_HOME', $public_origin);
    define('WP_SITEURL', $public_origin);
} elseif ($domain) {
    define('WP_HOME', 'https://' . $domain);
    define('WP_SITEURL', 'https://' . $domain);
}

define('WP_DEBUG', false);
define('WP_DEBUG_LOG', false);
define('WP_DEBUG_DISPLAY', false);

define('DISALLOW_FILE_EDIT', true);
define('FS_METHOD', 'direct');

define('WP_AUTO_UPDATE_CORE', 'minor');

define('WP_MEMORY_LIMIT', '128M');
define('WP_MAX_MEMORY_LIMIT', '192M');

if (
    isset($_SERVER['HTTP_X_FORWARDED_PROTO']) &&
    $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https'
) {
    $_SERVER['HTTPS'] = 'on';
}

if (!defined('ABSPATH')) {
    define('ABSPATH', __DIR__ . '/');
}

require_once ABSPATH . 'wp-settings.php';
```

### 9. 宿主机 Caddy 站点配置

下面是标准 80/443 部署使用的站点配置。它只负责当前域名，不要求覆盖现有 `/etc/caddy/Caddyfile` 中的其他站点。

```caddyfile
__DOMAIN__ {
    reverse_proxy 127.0.0.1:__BLOG_PORT__ {
        header_up X-Real-IP {client_ip}
        header_up X-Forwarded-For {client_ip}
        header_up X-Forwarded-Proto https
    }
}
```

安装脚本会在 Caddy 配置目录的 `sites.d/` 中创建站点文件，并确保主 Caddyfile 导入该目录。已有主配置会保留，验证通过后才 reload。

## 四、手动部署顺序

如果你不使用一键脚本，可以按以下顺序执行：

```bash
cd /opt/docker/blog

# 1. 检查 Compose 模型
docker compose config -q

# 2. 拉取基础镜像并构建 PHP 镜像
docker compose pull db redis nginx
docker compose build php

# 3. 启动四个容器
docker compose up -d

# 4. 检查容器和源站
docker compose ps
curl -I -H 'Host: dahai.me' -H 'X-Forwarded-Proto: https' http://127.0.0.1:8080/

# 5. 检查并重新加载宿主机 Caddy
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload-or-restart caddy
```

不要直接对已有生产配置执行 `docker compose down -v`。这个命令会删除数据库和 Caddy 相关命名卷。

## 五、权限、缓存与安全边界

- `.env` 权限为 `0600`，其中密码只在首次运行时生成。
- `www/wp-config.php` 权限为 `0640`，数据库配置不向其他宿主机用户公开。
- 默认 PHP-FPM 使用 `ondemand` 和最多 2 个子进程，适合低内存 VPS。
- OPcache 默认开启，PHP 上传上限为 64MB。
- Nginx 禁止上传目录执行 PHP，并屏蔽 `wp-config.php`、隐藏文件和说明文件。
- 固定链接使用 `/%postname%/`，不为旧日期链接提供兼容跳转。
- Cloudflare SSL/TLS 建议使用 Full (strict)，宿主机 Caddy 继续持有有效域名证书。
- 数据库和上传目录需要定期备份，并复制到另一台机器，不能只留在本机。

## 六、实际隔离测试

我在一台 Debian 13 隔离环境中完成验证：使用独立部署目录、独立 Caddy 配置目录、独立 Compose 项目与回环测试端口。

验证结果包括：

- Nginx、PHP-FPM、MariaDB、Redis 四个容器均为健康状态。
- 源站 `/wp-admin/install.php` 返回 `200`。
- 宿主机 Caddy 配置校验通过，公网 HTTPS 最终返回 `200`。
- HTTP 返回 `308`，完整跳转为 `https://localhost:18443/wp-admin/install.php`。
- 不传域名和端口参数复跑时，仍能读取 `.env` 中的部署参数。
- 复跑前后 `.env`、Compose、Nginx、PHP 和 wp-config 的 SHA-256 均未变化。
- Docker 子网与 Nginx 可信网关一致，FPM 和 OPcache 均已生效。
- `www/wp-config.php` 权限为 `0640`，复跑不会递归修改整个 `www/` 的权限。
- 验证完成后，测试容器、网络、卷和目录均已清理。

## 七、一键安装脚本

下载包包含安装脚本、全部配置模板和中文说明；脚本按模板生成配置，不会另造一套目录或容器结构。

- **下载：**[bwg-wordpress-one-click.zip](/downloads/bwg-wordpress-one-click.zip)
- **版本：**`2.0.2`
- **ZIP SHA-256：**`3a6cb07e11b636dfbec1bbccfa393aec849323f5d564ff5e25c647e4cd50a1eb`

### 使用方法

```bash
unzip bwg-wordpress-one-click.zip
cd bwg-wordpress

# 校验包中的脚本和模板
sha256sum -c SHA256SUMS

# 查看脚本与帮助
less deploy-bwg-wordpress.sh
bash deploy-bwg-wordpress.sh --help

# 将域名替换成自己的域名后执行
sudo bash deploy-bwg-wordpress.sh blog.example.com
```

默认安装目录为 `/opt/docker/blog`，宿主机 Nginx 回环端口为 `8080`，Caddy 配置目录为 `/etc/caddy`。

如果 Docker 网络与默认子网冲突，可以调整：

```bash
sudo BLOG_SUBNET=172.30.0.0/24 BLOG_GATEWAY=172.30.0.1 \
  bash deploy-bwg-wordpress.sh blog.example.com
```

重复执行会复用 `.env` 和现有配置。只校验但不启动或 reload 宿主机 Caddy 时，可以使用：

```bash
sudo SKIP_SERVICE_ACTIONS=1 bash deploy-bwg-wordpress.sh blog.example.com
```

### 脚本全文

```bash
#!/usr/bin/env bash
# Deploy the BandwagonHost-style WordPress stack: host Caddy + Docker Nginx/PHP/MariaDB/Redis.
set -Eeuo pipefail
IFS=$'\n\t'
umask 077

VERSION='2.0.2'
INSTALL_DIR="${INSTALL_DIR:-/opt/docker/blog}"
CADDY_CONFIG_ROOT="${CADDY_CONFIG_ROOT:-/etc/caddy}"
REQUESTED_DOMAIN="${1:-${DOMAIN:-}}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-blog}"
EXPLICIT_HTTP_PORT="${HTTP_PORT:-}"
EXPLICIT_HTTPS_PORT="${HTTPS_PORT:-}"
BLOG_PORT="${BLOG_PORT:-8080}"
BLOG_SUBNET="${BLOG_SUBNET:-172.19.0.0/24}"
BLOG_GATEWAY="${BLOG_GATEWAY:-172.19.0.1}"
HTTP_PORT="${HTTP_PORT:-80}"
HTTPS_PORT="${HTTPS_PORT:-443}"
SKIP_DEPENDENCIES="${SKIP_DEPENDENCIES:-0}"
SKIP_SERVICE_ACTIONS="${SKIP_SERVICE_ACTIONS:-0}"
PULL_IMAGES="${PULL_IMAGES:-1}"
WORDPRESS_DOWNLOAD_URL="${WORDPRESS_DOWNLOAD_URL:-https://wordpress.org/latest.tar.gz}"
MARKER='.bwg-wordpress-oneclick'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { printf '\033[1;34m[INFO]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[WARN]\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31m[ERROR]\033[0m %s\n' "$*" >&2; exit 1; }
trap 'die "Failed at line $LINENO. Review the output before rerunning."' ERR

if [[ "${1:-}" == '--help' || "${1:-}" == '-h' ]]; then
    cat <<'HELP'
Usage:
  sudo bash deploy-bwg-wordpress.sh blog.example.com

Defaults:
  INSTALL_DIR=/opt/docker/blog
  CADDY_CONFIG_ROOT=/etc/caddy
  COMPOSE_PROJECT_NAME=blog
  BLOG_PORT=8080
  BLOG_SUBNET=172.19.0.0/24
  BLOG_GATEWAY=172.19.0.1
  HTTP_PORT=80
  HTTPS_PORT=443

Optional:
  SKIP_DEPENDENCIES=1    Do not install system packages
  SKIP_SERVICE_ACTIONS=1 Validate configs but do not start/reload host Caddy
  PULL_IMAGES=0          Do not pull Docker images

The script expects the templates/ directory from the same package.
HELP
    exit 0
fi

[[ "$EUID" -eq 0 ]] || die 'Run as root, for example with sudo.'
for name in docker-compose.yml Dockerfile .env.example Caddyfile.site Caddyfile.site-custom; do
    [[ -f "$SCRIPT_DIR/templates/$name" ]] || die "Missing template: templates/$name"
done
if ! command -v openssl >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1 || ! command -v tar >/dev/null 2>&1; then
    [[ "$SKIP_DEPENDENCIES" != '1' ]] || die 'openssl, curl and tar are required.'
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y --no-install-recommends ca-certificates openssl curl tar
fi
command -v realpath >/dev/null 2>&1 || die 'realpath (coreutils) is required.'

validate_domain() {
    local domain="$1"
    [[ -n "$domain" ]] || die 'A domain is required.'
    [[ "$domain" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] || die 'Invalid domain.'
    [[ "$domain" != *'..'* && "$domain" != *'.-'* && "$domain" != *'-.'* ]] || die 'Invalid domain labels.'
    if [[ "$domain" != 'localhost' ]]; then
        [[ "$domain" == *.* ]] || die 'Use a fully qualified domain name.'
        [[ ! "$domain" =~ ^[0-9.]+$ ]] || die 'Use a domain rather than an IP address.'
    fi
}
validate_port() {
    local value="$2"
    [[ "$value" =~ ^[0-9]+$ ]] || die "$1 must be numeric."
    (( value >= 1 && value <= 65535 )) || die "$1 is outside the valid range."
}
if [[ -n "$REQUESTED_DOMAIN" ]]; then
    validate_domain "$REQUESTED_DOMAIN"
fi
validate_port BLOG_PORT "$BLOG_PORT"
validate_port HTTP_PORT "$HTTP_PORT"
validate_port HTTPS_PORT "$HTTPS_PORT"
[[ "$COMPOSE_PROJECT_NAME" =~ ^[a-z][a-z0-9-]*$ ]] || die 'Invalid Compose project name.'
[[ "$BLOG_SUBNET" =~ ^[0-9.]+/[0-9]+$ ]] || die 'Invalid BLOG_SUBNET.'
[[ "$BLOG_GATEWAY" =~ ^[0-9.]+$ ]] || die 'Invalid BLOG_GATEWAY.'

install_docker() {
    [[ "$SKIP_DEPENDENCIES" != '1' ]] || die 'Docker is missing and dependency installation is disabled.'
    [[ -r /etc/os-release ]] || die 'Cannot detect the operating system.'
    # shellcheck disable=SC1091
    . /etc/os-release
    [[ "${ID:-}" == 'debian' || "${ID:-}" == 'ubuntu' ]] || die 'Automatic Docker installation supports Debian/Ubuntu.'
    local codename="${VERSION_CODENAME:-${UBUNTU_CODENAME:-}}"
    [[ -n "$codename" ]] || die 'Cannot determine the distribution codename.'
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y --no-install-recommends ca-certificates curl gnupg openssl
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/%s %s stable\n' \
        "$(dpkg --print-architecture)" "$ID" "$codename" > /etc/apt/sources.list.d/docker.list
    apt-get update
    apt-get install -y --no-install-recommends \
        docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
}

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
    install_docker
fi
if ! command -v caddy >/dev/null 2>&1; then
    [[ "$SKIP_DEPENDENCIES" != '1' ]] || die 'Caddy is missing and dependency installation is disabled.'
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y --no-install-recommends caddy
fi
if command -v systemctl >/dev/null 2>&1; then
    systemctl enable --now docker
fi
docker info >/dev/null 2>&1 || die 'Docker daemon is unavailable.'

INSTALL_DIR="$(realpath -m "$INSTALL_DIR")"
CADDY_CONFIG_ROOT="$(realpath -m "$CADDY_CONFIG_ROOT")"
case "$CADDY_CONFIG_ROOT" in
    /|/boot|/dev|/etc|/usr|/var|/root|/home|/opt|/opt/docker|/srv|/tmp|/run|/proc|/sys)
        die "Unsafe Caddy configuration directory: $CADDY_CONFIG_ROOT" ;;
esac
[[ "$INSTALL_DIR$CADDY_CONFIG_ROOT" != *' '* ]] || die 'Paths containing spaces are not supported.'
case "$INSTALL_DIR" in
    /|/boot|/dev|/etc|/usr|/var|/root|/home|/opt|/opt/docker|/srv|/tmp|/run|/proc|/sys)
        die "Unsafe installation directory: $INSTALL_DIR" ;;
esac
[[ ! -L "$INSTALL_DIR" ]] || die 'INSTALL_DIR must not be a symbolic link.'
if [[ -e "$INSTALL_DIR" && ! -d "$INSTALL_DIR" ]]; then
    die 'INSTALL_DIR exists but is not a directory.'
fi
if [[ ! -d "$INSTALL_DIR" ]]; then
    mkdir -p "$INSTALL_DIR"
    chmod 0755 "$INSTALL_DIR"
fi
[[ "$(stat -c %u "$INSTALL_DIR")" == '0' ]] || die 'Installation directory must be owned by root.'
cd "$INSTALL_DIR"
shopt -s nullglob dotglob
entries=(*)
shopt -u nullglob dotglob
if (( ${#entries[@]} > 0 )) && [[ ! -f "$MARKER" ]]; then
    die 'Non-empty directory is not a recognized one-click installation.'
fi
if [[ ! -f "$MARKER" ]]; then
    printf 'version=%s\nproject=%s\n' "$VERSION" "$COMPOSE_PROJECT_NAME" > "$MARKER"
    chmod 0644 "$MARKER"
fi

if [[ ! -f .env && -z "$REQUESTED_DOMAIN" ]]; then
    die 'A domain is required for a new installation.'
fi
if [[ ! -f .env ]]; then
    log 'Creating .env with random database and WordPress secrets.'
    PUBLIC_HTTPS_ORIGIN="https://${REQUESTED_DOMAIN}"
    if [[ "$HTTPS_PORT" != '443' ]]; then
        PUBLIC_HTTPS_ORIGIN="${PUBLIC_HTTPS_ORIGIN}:${HTTPS_PORT}"
    fi
    env_tmp="$(mktemp '.env.tmp.XXXXXX')"
    sed \
        -e "s|__DOMAIN__|$REQUESTED_DOMAIN|g" \
        -e "s|__PUBLIC_HTTPS_ORIGIN__|$PUBLIC_HTTPS_ORIGIN|g" \
        -e "s|__COMPOSE_PROJECT_NAME__|$COMPOSE_PROJECT_NAME|g" \
        -e "s|__BLOG_PORT__|$BLOG_PORT|g" \
        -e "s|__HTTP_PORT__|$HTTP_PORT|g" \
        -e "s|__HTTPS_PORT__|$HTTPS_PORT|g" \
        -e "s|__BLOG_SUBNET__|$BLOG_SUBNET|g" \
        -e "s|__BLOG_GATEWAY__|$BLOG_GATEWAY|g" \
        -e "s|__MARIADB_PASSWORD__|$(openssl rand -hex 32)|g" \
        -e "s|__MARIADB_ROOT_PASSWORD__|$(openssl rand -hex 32)|g" \
        -e "s|__WORDPRESS_AUTH_KEY__|$(openssl rand -hex 32)|g" \
        -e "s|__WORDPRESS_SECURE_AUTH_KEY__|$(openssl rand -hex 32)|g" \
        -e "s|__WORDPRESS_LOGGED_IN_KEY__|$(openssl rand -hex 32)|g" \
        -e "s|__WORDPRESS_NONCE_KEY__|$(openssl rand -hex 32)|g" \
        -e "s|__WORDPRESS_AUTH_SALT__|$(openssl rand -hex 32)|g" \
        -e "s|__WORDPRESS_SECURE_AUTH_SALT__|$(openssl rand -hex 32)|g" \
        -e "s|__WORDPRESS_LOGGED_IN_SALT__|$(openssl rand -hex 32)|g" \
        -e "s|__WORDPRESS_NONCE_SALT__|$(openssl rand -hex 32)|g" \
        "$SCRIPT_DIR/templates/.env.example" > "$env_tmp"
    chmod 0600 "$env_tmp"
    mv "$env_tmp" .env
else
    warn 'Reusing existing .env; secrets will not be regenerated or printed.'
fi
chmod 0600 .env

get_env() {
    sed -n "s/^$1=//p" .env | tail -n 1
}
DOMAIN="$(get_env DOMAIN)"
COMPOSE_PROJECT_NAME="$(get_env COMPOSE_PROJECT_NAME)"
BLOG_PORT="$(get_env BLOG_PORT)"
BLOG_SUBNET="$(get_env BLOG_SUBNET)"
BLOG_GATEWAY="$(get_env BLOG_GATEWAY)"
stored_http_port="$(get_env HTTP_PORT)"
stored_https_port="$(get_env HTTPS_PORT)"
if [[ -n "$stored_http_port" && -n "$EXPLICIT_HTTP_PORT" && "$stored_http_port" != "$EXPLICIT_HTTP_PORT" ]]; then
    die 'HTTP_PORT conflicts with the existing .env value.'
fi
if [[ -n "$stored_https_port" && -n "$EXPLICIT_HTTPS_PORT" && "$stored_https_port" != "$EXPLICIT_HTTPS_PORT" ]]; then
    die 'HTTPS_PORT conflicts with the existing .env value.'
fi
if [[ -n "$stored_http_port" ]]; then
    HTTP_PORT="$stored_http_port"
fi
if [[ -n "$stored_https_port" ]]; then
    HTTPS_PORT="$stored_https_port"
fi
if [[ -z "$stored_http_port" || -z "$stored_https_port" ]]; then
    ports_tmp="$(mktemp '.env.ports.tmp.XXXXXX')"
    cat .env > "$ports_tmp"
    if [[ -z "$stored_http_port" ]]; then
        printf 'HTTP_PORT=%s\n' "$HTTP_PORT" >> "$ports_tmp"
    fi
    if [[ -z "$stored_https_port" ]]; then
        printf 'HTTPS_PORT=%s\n' "$HTTPS_PORT" >> "$ports_tmp"
    fi
    chmod 0600 "$ports_tmp"
    mv "$ports_tmp" .env
fi
for key in MARIADB_DATABASE MARIADB_USER MARIADB_PASSWORD MARIADB_ROOT_PASSWORD \
    WORDPRESS_AUTH_KEY WORDPRESS_SECURE_AUTH_KEY WORDPRESS_LOGGED_IN_KEY WORDPRESS_NONCE_KEY \
    WORDPRESS_AUTH_SALT WORDPRESS_SECURE_AUTH_SALT WORDPRESS_LOGGED_IN_SALT WORDPRESS_NONCE_SALT; do
    [[ -n "$(get_env "$key")" ]] || die "$key is missing from .env"
done
: "${BLOG_PORT:?BLOG_PORT is missing}"
: "${BLOG_SUBNET:?BLOG_SUBNET is missing}"
: "${BLOG_GATEWAY:?BLOG_GATEWAY is missing}"
: "${COMPOSE_PROJECT_NAME:?COMPOSE_PROJECT_NAME is missing}"
if [[ -n "$REQUESTED_DOMAIN" && "${REQUESTED_DOMAIN,,}" != "${DOMAIN,,}" ]]; then
    die 'The requested domain differs from the existing .env domain.'
fi
validate_domain "$DOMAIN"
validate_port BLOG_PORT "$BLOG_PORT"
validate_port HTTP_PORT "$HTTP_PORT"
validate_port HTTPS_PORT "$HTTPS_PORT"
export DOMAIN COMPOSE_PROJECT_NAME BLOG_PORT BLOG_SUBNET BLOG_GATEWAY HTTP_PORT HTTPS_PORT

computed_origin="https://${DOMAIN}"
if [[ "$HTTPS_PORT" != '443' ]]; then
    computed_origin="${computed_origin}:${HTTPS_PORT}"
fi
registered_origin="$(get_env PUBLIC_HTTPS_ORIGIN)"
if [[ -n "$registered_origin" && "$registered_origin" != "$computed_origin" ]]; then
    die 'PUBLIC_HTTPS_ORIGIN in .env does not match DOMAIN and HTTPS_PORT.'
fi
if [[ -z "$registered_origin" ]]; then
    origin_tmp="$(mktemp '.env.origin.tmp.XXXXXX')"
    cat .env > "$origin_tmp"
    printf 'PUBLIC_HTTPS_ORIGIN=%s\n' "$computed_origin" >> "$origin_tmp"
    chmod 0600 "$origin_tmp"
    mv "$origin_tmp" .env
fi
PUBLIC_HTTPS_ORIGIN="$computed_origin"
export PUBLIC_HTTPS_ORIGIN

render_template() {
    local source="$1"
    local target="$2"
    local mode="${3:-0644}"
    [[ ! -L "$target" ]] || die "$target must not be a symbolic link."
    if [[ -e "$target" && ! -f "$target" ]]; then
        die "$target exists but is not a regular file."
    fi
    if [[ -f "$target" ]]; then
        warn "Keeping existing $target"
        return
    fi
    local temporary
    temporary="$(mktemp "${target}.tmp.XXXXXX")"
    sed \
        -e "s|__DOMAIN__|$DOMAIN|g" \
        -e "s|__BLOG_PORT__|$BLOG_PORT|g" \
        -e "s|__BLOG_GATEWAY__|$BLOG_GATEWAY|g" \
        -e "s|__HTTP_PORT__|$HTTP_PORT|g" \
        -e "s|__HTTPS_PORT__|$HTTPS_PORT|g" \
        -e "s|__PUBLIC_HTTPS_ORIGIN__|$PUBLIC_HTTPS_ORIGIN|g" \
        "$source" > "$temporary"
    chmod "$mode" "$temporary"
    mv "$temporary" "$target"
}

mkdir -p nginx/logs php/conf.d php/php-fpm.d www
render_template "$SCRIPT_DIR/templates/docker-compose.yml" docker-compose.yml
render_template "$SCRIPT_DIR/templates/Dockerfile" Dockerfile
render_template "$SCRIPT_DIR/templates/nginx/nginx.conf" nginx/nginx.conf
render_template "$SCRIPT_DIR/templates/nginx/default.conf" nginx/default.conf
render_template "$SCRIPT_DIR/templates/php/conf.d/99-blog.ini" php/conf.d/99-blog.ini
render_template "$SCRIPT_DIR/templates/php/php-fpm.d/zz-blog.ini" php/php-fpm.d/zz-blog.ini
created_wp_config=0
if [[ ! -f www/wp-config.php ]]; then
    created_wp_config=1
fi
render_template "$SCRIPT_DIR/templates/www/wp-config.php" www/wp-config.php 0640

downloaded_wordpress=0
if [[ ! -f www/index.php ]]; then
    downloaded_wordpress=1
    log 'Downloading WordPress into www/.'
    download_dir="$(mktemp -d)"
    curl -fsSL "$WORDPRESS_DOWNLOAD_URL" -o "$download_dir/wordpress.tar.gz"
    tar -xzf "$download_dir/wordpress.tar.gz" -C "$download_dir"
    cp -a "$download_dir/wordpress/." www/
    rm -rf -- "$download_dir"
else
    warn 'Keeping the existing WordPress files in www/.'
fi
render_template "$SCRIPT_DIR/templates/www/wp-config.php" www/wp-config.php 0640
if [[ "$downloaded_wordpress" == '1' ]]; then
    chown -R 33:33 www
    find www -type d -exec chmod 2775 {} +
    find www -type f -exec chmod 0664 {} +
fi
if [[ "$created_wp_config" == '1' && -f www/wp-config.php ]]; then
    chown 33:33 www/wp-config.php
    chmod 0640 www/wp-config.php
fi

compose() {
    docker compose --project-name "$COMPOSE_PROJECT_NAME" --env-file .env \
        -f docker-compose.yml "$@"
}

log 'Validating the Compose model.'
compose config -q
if [[ "$PULL_IMAGES" == '1' ]]; then
    log 'Pulling Docker images.'
    compose pull db redis nginx
fi
log 'Building and starting the WordPress containers.'
compose up -d --build

for service_name in db redis php nginx; do
    container_name="${COMPOSE_PROJECT_NAME}-${service_name}"
    healthy=0
    for attempt in $(seq 1 60); do
        status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_name" 2>/dev/null || true)"
        if [[ "$status" == 'healthy' ]]; then
            healthy=1
            break
        fi
        sleep 5
    done
    [[ "$healthy" == '1' ]] || die "$container_name did not become healthy."
done

http_code="$(curl -sS --max-time 30 -o /dev/null -w '%{http_code}' \
    -H "Host: $DOMAIN" -H 'X-Forwarded-Proto: https' "http://127.0.0.1:${BLOG_PORT}/wp-admin/install.php")"
[[ "$http_code" == '200' ]] || die "WordPress origin returned HTTP $http_code."
printf 'WORDPRESS_ORIGIN_HTTP=%s\n' "$http_code"

mkdir -p "$CADDY_CONFIG_ROOT/sites.d"
main_caddyfile="$CADDY_CONFIG_ROOT/Caddyfile"
site_caddyfile="$CADDY_CONFIG_ROOT/sites.d/${DOMAIN}.conf"
import_line="import ${CADDY_CONFIG_ROOT}/sites.d/*.conf"
custom_ports=0
if [[ "$HTTP_PORT" != '80' || "$HTTPS_PORT" != '443' ]]; then
    custom_ports=1
fi

if [[ -f "$site_caddyfile" ]]; then
    warn "Keeping existing Caddy site config: $site_caddyfile"
else
    if [[ -f "$main_caddyfile" ]] && grep -Fq "$DOMAIN" "$main_caddyfile"; then
        die 'The domain already appears in the main Caddyfile; review it before continuing.'
    fi
    if [[ "$custom_ports" == '1' ]]; then
        render_template "$SCRIPT_DIR/templates/Caddyfile.site-custom" "$site_caddyfile"
    else
        render_template "$SCRIPT_DIR/templates/Caddyfile.site" "$site_caddyfile"
    fi
fi

if [[ ! -f "$main_caddyfile" ]]; then
    main_tmp="$(mktemp "${main_caddyfile}.tmp.XXXXXX")"
    if [[ "$custom_ports" == '1' ]]; then
        printf '{\n\tauto_https disable_redirects\n\thttp_port %s\n\thttps_port %s\n}\n\n%s\n' \
            "$HTTP_PORT" "$HTTPS_PORT" "$import_line" > "$main_tmp"
    else
        printf '%s\n' "$import_line" > "$main_tmp"
    fi
    chmod 0644 "$main_tmp"
    mv "$main_tmp" "$main_caddyfile"
elif ! grep -Fxq "$import_line" "$main_caddyfile"; then
    if [[ "$custom_ports" == '1' ]]; then
        die 'Custom ports require a recognized isolated Caddyfile; refusing to alter an existing global configuration.'
    fi
    main_tmp="$(mktemp "${main_caddyfile}.tmp.XXXXXX")"
    cp -a "$main_caddyfile" "${main_caddyfile}.backup-$(date -u +%Y%m%dT%H%M%SZ)"
    cat "$main_caddyfile" > "$main_tmp"
    printf '\n%s\n' "$import_line" >> "$main_tmp"
    chmod 0644 "$main_tmp"
    caddy validate --config "$main_tmp" --adapter caddyfile
    mv "$main_tmp" "$main_caddyfile"
fi

log 'Validating the complete host Caddy configuration.'
caddy validate --config "$main_caddyfile" --adapter caddyfile

if [[ "$CADDY_CONFIG_ROOT" != '/etc/caddy' && "$SKIP_SERVICE_ACTIONS" != '1' ]]; then
    die 'A custom CADDY_CONFIG_ROOT requires SKIP_SERVICE_ACTIONS=1 to avoid touching the system Caddy service.'
fi
if [[ "$SKIP_SERVICE_ACTIONS" != '1' ]]; then
    systemctl enable --now caddy
    systemctl reload-or-restart caddy
fi

if [[ "$SKIP_SERVICE_ACTIONS" != '1' ]]; then
    connect_ip='127.0.0.1'
    curl_insecure=()
    if [[ "$DOMAIN" == 'localhost' ]]; then
        curl_insecure=(-k)
    fi
    public_port=''
    if [[ "$HTTPS_PORT" != '443' ]]; then
        public_port=":$HTTPS_PORT"
    fi
    public_http_port=''
    if [[ "$HTTP_PORT" != '80' ]]; then
        public_http_port=":$HTTP_PORT"
    fi
    https_code="$(curl "${curl_insecure[@]}" -L -sS --max-time 30 \
        --resolve "${DOMAIN}:${HTTPS_PORT}:${connect_ip}" \
        -o /dev/null -w '%{http_code}' "https://${DOMAIN}${public_port}/")"
    [[ "$https_code" == '200' ]] || die "Public HTTPS returned HTTP $https_code."
    expected_redirect="${PUBLIC_HTTPS_ORIGIN}/wp-admin/install.php"
    redirect_result="$(curl -sS --max-time 20 \
        --resolve "${DOMAIN}:${HTTP_PORT}:${connect_ip}" \
        -o /dev/null -w '%{http_code} %{redirect_url}' \
        "http://${DOMAIN}${public_http_port}/wp-admin/install.php")"
    [[ "${redirect_result%% *}" == '308' ]] || die 'Unexpected HTTP redirect status.'
    [[ "${redirect_result#* }" == "$expected_redirect" ]] || die 'Unexpected HTTP redirect target.'
    printf 'PUBLIC_HTTPS_HTTP=%s\n' "$https_code"
    printf 'HTTP_REDIRECT=%s\n' "${redirect_result#* }"
fi

printf '\n\033[1;32m[SUCCESS]\033[0m Deployment is complete.\n'
printf 'WordPress directory: %s\n' "$INSTALL_DIR"
printf 'Caddy configuration: %s\n' "$main_caddyfile"
printf 'Website: %s\n' "$PUBLIC_HTTPS_ORIGIN"
printf 'Finish setup: %s/wp-admin/install.php\n' "$PUBLIC_HTTPS_ORIGIN"
printf 'Manage containers: cd %s && docker compose ps\n' "$INSTALL_DIR"
if [[ "$SKIP_SERVICE_ACTIONS" == '1' ]]; then
    printf 'Host Caddy was validated but not started. Start it with: caddy run --config %s\n' "$main_caddyfile"
fi
```
