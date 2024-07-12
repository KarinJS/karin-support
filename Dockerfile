FROM node:22-slim

WORKDIR /home/nodeRule

# 安装环境
RUN apt-get update && apt-get install -yq libgbm-dev gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libnss3 lsb-release xdg-utils wget
RUN npx @puppeteer/browsers install chrome@117 --platform linux --path /opt/.local-chromium

# 拷贝项目文件
COPY package.json /home/nodeRule/
COPY src /home/nodeRule/src/
RUN chown -R node /home/nodeRule && \
    npm install -g pnpm && \
    pnpm install --no-cache


# 设置环境变量
ARG PORT=7005
ARG TOKEN=Karin-Puppeteer
ARG TIMEOUT=90000
ARG DEBUG=false
ENV PORT=$PORT
ENV TOKEN=$TOKEN
ENV TIMEOUT=$TIMEOUT
ENV DEBUG=$DEBUG

USER node

EXPOSE $PORT
ENTRYPOINT ["pnpm", "run"]
CMD ["app"]