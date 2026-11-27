# frontend

`tft基米助手` 的界面与构建工程（pnpm workspace）。APK 里打包的是 `apps/react` 的构建产物，其余 app 是同一套工程内的配套应用。

## 工作区结构

```
apps/
  react/     主界面（React 19 + Vite + TailwindCSS），构建产物进 android/assets/www
  website/   官网（Next.js 静态导出）
  electron/  桌面端外壳（Electron）
  server/    可选的数据服务（Hono + MongoDB）
packages/
  types/ utils/ logger/ ui/ config/ react-helper/ api-client/ bridge/ crawler/ db/
```

`apps/react` 不依赖 `server` / `db` / `crawler`，离线数据来自 APK 内置快照与云端同步。

## 环境要求

- Node.js 22+
- pnpm 10.12.4（`packageManager` 字段强制，`preinstall` 会拦截 npm / yarn）

## 安装与构建

```bash
pnpm install --ignore-scripts --no-frozen-lockfile

pnpm run build:packages     # 按依赖顺序构建 packages
pnpm run build:react        # 产物：apps/react/dist
```

`build:packages` 的顺序由根 `package.json` 固定：`types` → `utils` → `logger` / `bridge` → `db` / `react-helper` / `api-client` → `crawler`。

其他构建：

```bash
pnpm run build:website      # 静态导出到 apps/website/out
pnpm run build:electron     # 桌面端
pnpm run build:server       # 数据服务
```

## 开发

```bash
pnpm dev:react              # Vite dev server
pnpm dev:website            # Next.js dev server
pnpm dev:electron           # Electron
```

## 质量检查

```bash
pnpm lint
pnpm typecheck
pnpm check                  # 两者并行
```

## 约定

- TypeScript strict，不用 `any`；无法避免时用 `unknown` 再收窄
- 优先复用 `packages/utils` 与现有依赖，不重复造轮子
- 注释写"为什么"，不写"是什么"
- 状态管理用 Zustand，路由集中在 `apps/react/src/routes.tsx`

## 与 APK 的关系

`pnpm run build:react` 产出 `apps/react/dist`，由仓库根的 `tools/prepare_assets.mjs` 复制到 `android/assets/www`，再随 `android/build.sh` 打进 APK。
