FROM node:24-bookworm-slim
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /workspace
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/desktop-host/package.json apps/desktop-host/package.json
COPY apps/web-receiver/package.json apps/web-receiver/package.json
COPY packages/caption-protocol/package.json packages/caption-protocol/package.json
COPY packages/caption-client/package.json packages/caption-client/package.json
RUN pnpm install --frozen-lockfile=false
COPY . .
CMD ["pnpm", "check"]
