# grandma-tutorial

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## Understanding the Architecture

This project is built with Electron and Vite. To understand how it works, it's recommended to read up on their core concepts:

-   **Electron**: The framework for building desktop apps with web technologies. Pay special attention to the [Main and Renderer Process model](https://www.electronjs.org/docs/latest/tutorial/process-model).
-   **Vite**: A fast frontend build tool that compiles the React code for the user interface. You can learn more about its philosophy [here](https://vitejs.dev/guide/why.html).
-   **electron-vite**: The tool that integrates Electron and Vite. Check out its [documentation](https://electron-vite.org/) to see how it structures the project.
