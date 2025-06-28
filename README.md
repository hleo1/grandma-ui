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
$ OPENAI_API_KEY=<key> GEMINI_KEY=<key> npm run dev
```

### Build

```bash
# For windows
$ OPENAI_API_KEY=<key> GEMINI_KEY=<key> npm run build:win

# For macOS
$ OPENAI_API_KEY=<key> GEMINI_KEY=<key> npm run build:mac

# For Linux
$ OPENAI_API_KEY=<key> GEMINI_KEY=<key> npm run build:linux
```

## Understanding the Architecture

This project is built with Electron and Vite. To understand how it works, it's recommended to read up on their core concepts:

-   **Electron**: The framework for building desktop apps with web technologies. Pay special attention to the [Main and Renderer Process model](https://www.electronjs.org/docs/latest/tutorial/process-model).
-   **Vite**: A fast frontend build tool that compiles the React code for the user interface. You can learn more about its philosophy [here](https://vitejs.dev/guide/why.html).
-   **electron-vite**: The tool that integrates Electron and Vite. Check out its [documentation](https://electron-vite.org/) to see how it structures the project.


## Resource Server Setup

The application includes a FastAPI server that handles search queries and full text requests. Follow these steps to set up the Python server:

### Prerequisites

- Python 3.11 installed on your system
- pip (Python package installer)

### Installation

1. Navigate to the resource server directory:
   ```bash
   cd resource_server
   ```

2. (Optional but recommended) Create a virtual environment:
   ```bash
   python -m venv venv
   
   # Activate the virtual environment
   # On macOS/Linux:
   source venv/bin/activate
   # On Windows:
   venv\Scripts\activate
   ```

3. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Running the Server

Start the FastAPI server:
```bash
python main.py --license-key <thirdai-license-key>
```

The server will start on `http://localhost:8000` by default.

### API Endpoints

- **POST `/resources`** - Main endpoint for processing search queries and full text requests
- **GET `/health`** - Health check endpoint
- **GET `/docs`** - Automatic API documentation (Swagger UI)

### Development

The server includes placeholder processing logic that you can replace with your own implementation. Look for `TODO` comments in `main.py` to see where to add your data processing logic.

