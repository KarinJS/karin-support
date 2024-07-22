FROM node:slim

# 设置环境变量
ARG PORT=7005
ARG TOKEN=Karin-Puppeteer
ARG TIMEOUT=90000
ARG DEBUG=false
ENV PORT=$PORT
ENV TOKEN=$TOKEN
ENV TIMEOUT=$TIMEOUT
ENV DEBUG=$DEBUG

# 安装环境
RUN apt-get update && apt-get install -yq --no-install-recommends \
    libgbm-dev libasound2 libatk1.0-0 libc6 libcairo2 libdbus-1-3 libexpat1 \
    libgcc1 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 \
    libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 \
    libxrender1 libxss1 ca-certificates fonts-liberation libnss3 lsb-release \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-freefont-ttf \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 拷贝项目文件
COPY package.json /home/nodeRule/
COPY src /home/nodeRule/src/

WORKDIR /home/nodeRule

RUN chown -R node /home/nodeRule && \
    npm install -g pnpm && \
    pnpm install --no-cache && \
    pnpm run init

USER node

EXPOSE $PORT
ENTRYPOINT ["pnpm", "run"]
CMD ["app"]