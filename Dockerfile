FROM node:22-bookworm-slim

WORKDIR /app

ENV YARN_ENABLE_GLOBAL_CACHE=false

RUN corepack enable

COPY package.json yarn.lock ./
RUN yarn install --immutable

COPY tsconfig.json ./
COPY src ./src
RUN yarn build

RUN chown -R node:node /app
USER node

ENV NODE_ENV=production
EXPOSE 9464

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD node -e "fetch('http://127.0.0.1:9464/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["yarn", "start"]
