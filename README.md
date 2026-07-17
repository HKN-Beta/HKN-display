# HKN Display Board (`display`)

Welcome to the Facilities Committee onboarding project.

This repo is a Nuxt 4 sandbox where each onboardee builds a display page under
their own alias, so work can be reviewed and merged without collisions.

## Runtime Requirements

- Node.js 22 or newer
- npm 10 or newer
- Docker 24 or newer (for container testing)

You can install these with the `install.bat` (windows) or `install.sh`
(macOS/Linux) scripts in the docs folder. See the docs for more details:

- [Windows Dependencies Installation Guide](docs/deps_win.md)
- [MacOS Dependencies Installation Guide](docs/deps_mac.md)
- [Linux Dependencies Installation Guide](docs/deps_linux.md)

## Getting Started

### 1. Clone

```bash
git clone https://github.com/HKN-Beta/HKN-display.git
cd HKN-display
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run locally

```bash
npm run dev
```

Default local URL: `http://localhost:3000`

## Project Structure (Alias Isolation)

Each onboardee must use their alias folder in all relevant locations:

- `app/pages/<alias>/index.vue`
- `app/components/<alias>/...`
- `app/composables/<alias>/...`
- `server/api/<alias>/...`

Example:

```text
app/
  pages/
    jorgenel/
      index.vue
  components/
    jorgenel/
      TimeWidget.vue
      WeatherWidget.vue
  composables/
    jorgenel/
      useWeather.ts
server/
  api/
    jorgenel/
      display/
        weather.get.ts
```

## Nuxt 4 Notes (Important)

- Routing is file-system based: `app/pages/<alias>/index.vue` maps to
  `/<alias>`.
- Composables in nested alias folders are auto-imported via project config.
- Components in alias subfolders are auto-registered with directory prefix
  naming.
  - Example: `app/components/jorgenel/TimeWidget.vue` is used as
    `<JorgenelTimeWidget />`.

## Onboarding Minimum Requirements

Each alias display should include at least:

1. A reactive clock (updates every second).
2. At least one required alias-scoped server API endpoint under
   `server/api/<alias>/...`, consumed by your page.
3. Asynchronous data from at least one external/public API (directly or via your
   alias server API).
4. At least two user-configurable settings.
5. Modular component architecture (not a monolith).
6. Lifecycle cleanup (`onUnmounted`) for intervals/listeners.

## PR Quality Gate (Required)

For pull requests targeting `main`, CI runs:

- `format:check`
- `lint`
- `typecheck`

Before opening a PR, run the same checks locally:

```bash
npm run format
npm run lint
npm run typecheck
```

## Submission Guidelines

Open a PR with your changes. You should only be modifying/adding files under
your alias folders and any shared components/composables if necessary. Any
changes to shared code must be justified and reviewed carefully.

In the PR description, summarize:

- Which APIs you integrated.
- How you satisfy each requirement above.
- Confirmation that format/lint/typecheck passed.
- Any special run/test steps.

## Docker Build and Container Testing

Use this before submitting your PR.

### 1. Build image

```bash
docker build -t hkn-display .
```

### 2. Run container

```bash
docker run --rm -p 3000:3000 hkn-display
```

### 3. Verify routes in container (required)

As an onboardee, you must verify your display works in the container:

- Base app: `http://localhost:3000/`
- Default page: `http://localhost:3000/default`
- Your display page: `http://localhost:3000/<your-alias>`

Also verify your alias APIs respond:

- `http://localhost:3000/api/<your-alias>/...`

Optional quick check with curl:

```bash
curl -I http://localhost:3000/<your-alias>
```

If your display fails in container but works locally, check:

- Hardcoded `localhost` API calls in client code.
- Missing runtime env vars.
- External API/network restrictions from container environment.
