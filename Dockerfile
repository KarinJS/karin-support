FROM node:22

WORKDIR /home/nodeRule

# 安装环境
RUN apt-get update && apt-get install -y wget gnupg2 ffmpeg build-essential fonts-noto-color-emoji && apt-get clean && \
    wget --no-check-certificate https://dl.google.com/linux/linux_signing_key.pub && \
    apt-key add linux_signing_key.pub && \
    sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'  && \
    apt-get update && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 --no-install-recommends && apt-get clean && \
    rm -rf /var/lib/apt/lists/* && 

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