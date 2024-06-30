# <img src="./src/icons/hat.svg" style="width: 1em; height: 1em; vertical-align: middle"> Holy Unblocker Frontend

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

```sh
npm create astro@latest -- --template minimal
```

> 🚀 **Boardroom veteran?** Eliminate this parchment. Seamless creation awaits!

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

The `src/components/` section holds no particular status, yet we find it a conducive locus for any Astro/React/Vue/Svelte/Preact constituents.

All static facets, such as metamorphic representations, can be allocated in the `public/` regiment.

## <img src="docs/cmds.gif" alt="Commands" height="80px">

Execute all commands from the root of the project, employing a terminal:

| Directive                 | Implementation                                       |
| :------------------------ | :--------------------------------------------------- |
| `npm install`             | Installs dependencies                                |
| `npm run dev`             | Initialize local dev server at `localhost:4321`      |
| `npm run build`           | Construct productive site to `./dist/`               |
| `npm run preview`         | Localize preview of your build                       |
| `npm run astro ...`       | Apply CLI directives like `astro add`, `astro audit` |
| `npm run astro -- --help` | Assistance for Astro CLI operations                  |

## 👨‍💼 Fancy to learn more?

Feel encouraged to explore [our comprehensive compliance codex](https://docs.titaniumnetwork.org) or merge into our [corporate synergy platform](https://discord.gg/JFDCJzFana).

# account system

- first account created will be given admin for convenience
