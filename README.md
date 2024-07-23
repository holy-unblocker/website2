# <img src="./src/icons/hat.svg" style="width: 1em; vertical-align: middle"> Holy Unblocker Frontend 2

## [PROXY SITE HOSTING STARTING AT $6.99. CHECK OUT BILLIGERHOST.](https://billing.billigerhost.com/aff.php?aff=94)

> NOW WITH 0% REACT CODE >:)
> Written in Astro, TypeScript, and SCSS

[JOIN OUR DISCORD](https://discord.gg/VZguJSmMcN)

## <img src="docs/quickstart.gif" alt="Quick Start" height="80px">

Host your own instance of Holy Unblocker, no configuration required at all.

You will need to install git and at least NodeJS v19.

```sh
git clone https://github.com/holy-unblocker/website2
cd website2
npm install
npm run build
npm start
```

## <img src="docs/config.gif" alt="Configuration" height="80px">

This program will look for a config in `./config/config.js`. You copy the example config:

```sh
cp ./config/config.example.js ./config.js
```

We provide an example configuration in [./config/config.example.js](./config/config.example.js)

## <img src="docs/hosting.gif" alt="Hosting" height="80px">

> This guide assumes your using linux as your host

1. Install dependencies

   You will need to install [git](https://git-scm.com/download/linux).

2. Install NodeJS

   > You need at least NodeJS v17 to deploy Holy Unblocker.

   We recommend installing from [NodeSource](https://github.com/nodesource/distributions#table-of-contents), or using [Node Version Manager](https://github.com/nvm-sh/nvm#table-of-contents) to install the latest version.

   [Most distros usually have very outdated versions of NodeJS.](https://gist.github.com/e9x/b549f46081ce794914461f2fbb9566bd#file-nodejs-across-linux-distributions-md)

   Verify you're using NodeJS v17 or higher:

   ```sh
   node -v
   ```

3. Install [PM2](https://pm2.keymetrics.io/docs/usage/quick-start/)

   > PM2 is a daemon process manager that will help you manage and keep your application online. Getting started with PM2 is straightforward, it is offered as a simple and intuitive CLI, installable via NPM.

   ```sh
   npm i -g pm2
   ```

4. Install the repo

   ```sh
   git clone https://github.com/holy-unblocker/website2
   cd website2
   npm install
   npm run build
   ```

5. Start the frontend in PM2

   This will start a process in PM2 called "holy".

   ```sh
   pm2 start ./run-server.js --name holy
   ```

6. View the logs

   > Press <kbd>CTRL</kbd> + <kbd>C</kbd> to exit the logs.

   ```sh
   pm2 logs holy
   ```

7. Save your PM2 config and enable running on startup

   This will make it so `pm2` runs automatically when your VPS restarts.

   ```sh
   pm2 save
   pm2 startup
   ```

8. Setup a reverse proxy

   By default, Holy Unblocker listens on http://127.0.0.1:8080/ and isn't accessible over the internet.

   Keep in mind that you want to setup HTTPS/SSL, otherwise Ultraviolet won't work.

   I personally recommend Caddy as a reverse proxy.

   > Caddy is a powerful, extensible platform to serve your sites, services, and apps...

   https://caddyserver.com/docs/

   You can view the example Caddyfile at [./config/Caddyfile](./config/Caddyfile)

## <img src="docs/struct.gif" alt="Project Structure" height="80px">

Within the boundaries of your Astro enterprise, you'll unveil the succeeding unambiguous hierarchical construct:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro utilizes `.astro` or `.md` documents located in the `src/pages/` division. Each file is propagated as a route subject to its filenomenclature.

The `src/components/` section holds no particular status, yet we find it a conducive locus for any Astro constituents.

All static facets, such as metamorphic representations, can be allocated in the `public/` regiment.

## <img src="docs/cmds.gif" alt="Commands" height="80px">

Execute all commands from the root of the project, employing a terminal:

| Directive                 | Implementation                                       |
| :------------------------ | :--------------------------------------------------- |
| `npm install`             | Installs dependencies                                |
| `npm start`               | Starts Holy Unblocker                                |
| `npm run dev`             | Initialize local dev server at `localhost:4321`      |
| `npm run build`           | Construct productive site to `./dist/`               |
| `npm run preview`         | Localize preview of your build                       |
| `npm run astro ...`       | Apply CLI directives like `astro add`, `astro audit` |
| `npm run astro -- --help` | Assistance for Astro CLI operations                  |

## <img src="docs/acc.gif" alt="Account System" height="80px">

The first account created will be given admin for convenience.

## SVG formatting guide

im writing this here because I look crazy for updating like 30 svgs in one commit

- keep `style=` attributes
- NO BLOAT:

  - all icons in `./src/icons/
  - no CSS `class=` attributes
  - no inkscape bloat:
    - any inkscape:data tags
    - no JS `id=` attributes

- try to use <defs> if your code is high performance (eg. theatre search results, proxy omnibox search results)
- ALWAYS SET `fill="none"` SO THE SVG DOESN'T LOAD UNTIL THE CSS IS READY

  - if the file is meant to be a standalone .svg (eg. in [./public/](./public/)):

    - set `xmlns`: `xmlns="http://www.w3.org/2000/svg"`
    - add the `<?xml` thing: `<?xml version="1.0" encoding="UTF-8" standalone="no"?>`

  - otherwise, DO NOT ADD THE ABOVE, IT IS USELESS IF THE ICON IS EMBEDDED ON THE PAGE

  - `root.css` sets the fill to currentColor
  - the only exception to this is [./src/icons/ultraviolet.svg](./src/icons/)
  - the Ultraviolet SVG with colors doesn't exist anywhere else (yet?)
    - I made the svg btw
