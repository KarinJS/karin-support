# 第一阶段：安装依赖
FROM node:slim AS base

# 安装依赖包
RUN apt-get update && apt-get install -yq --no-install-recommends \
    libgbm-dev libasound2 libatk1.0-0 libc6 libcairo2 libdbus-1-3 libexpat1 \
    libgcc1 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 \
    libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 \
    libxrender1 libxss1 ca-certificates fonts-liberation libnss3 lsb-release \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-freefont-ttf \
    ffmpeg && apt-get clean && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm

# 第二阶段：初始化运行环境
FROM base AS builder

# 拷贝项目文件
COPY package.json /home/nodeRule/
COPY src/init.js /home/nodeRule/src/init.js

WORKDIR /home/nodeRule

# 安装项目依赖
RUN chown -R node /home/nodeRule && \
    pnpm install --no-cache && \
    pnpm run init

# 第三阶段：构建最终镜像
FROM base

# 设置环境变量
ARG PORT=7005
ARG TOKEN=Karin-Puppeteer
ARG TIMEOUT=90000
ARG CACHE_TTL=1440
ARG CACHE_MAXKEY=1000
ARG DEBUG=false
ENV PORT=$PORT
ENV CACHE_TTL=$CACHE_TTL
ENV CACHE_MAXKEY=$CACHE_MAXKEY
ENV TOKEN=$TOKEN
ENV TIMEOUT=$TIMEOUT
ENV DEBUG=$DEBUG

# 从 builder 阶段拷贝已安装好的依赖
COPY --from=builder /home/nodeRule /home/nodeRule
COPY src /home/nodeRule/src/

WORKDIR /home/nodeRule

# 设置权限
RUN chown -R node /home/nodeRule

# 切换到非root用户
USER node

# 暴露端口
EXPOSE $PORT

# 设置默认启动命令
ENTRYPOINT ["pnpm", "run"]
CMD ["app"]
