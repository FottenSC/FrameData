# Fighting Game Frame Data Viewer

This is a web application designed to display frame data for characters in fighting games like Soul Calibur VI and Tekken 8. It uses React, Vite, and TypeScript to load and display move lists from static JSON files in the browser.

## Features

- Displays character move lists for multiple supported games (Soul Calibur VI, Tekken 8).
- Sortable and filterable frame data tables.
- Loads data from local game-specific JSON files under `public/Games/{Game}/...`.
- Built with modern web technologies for a fast and responsive experience.

## Tech Stack

- **Frontend:** React, TypeScript
- **Routing:** React Router
- **State Management:** React Context API
- **Build Tool:** Vite
- **Styling:** Tailwind CSS, shadcn/ui
- **Data Source:** Static JSON files in `public/Games`

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Raevhaal/FrameData.git
    cd FrameData
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Database:**
    - Ensure you have the required database files in the `public/` directory, organized by game ID (e.g., `public/SoulCalibur6/FrameData.db`, `public/Tekken8/FrameData.db`).
    - No WebAssembly or SQL.js needed. Ensure the JSON files are present under `public/Games`.

## Available Scripts

- **`npm run dev`**: Runs the app in development mode with hot reloading. Open [http://localhost:5173](http://localhost:5173) (or the port specified by Vite) to view it in the browser.
- **`npm run build`**: Builds the app for production to the `dist` folder. It correctly bundles React in production mode and optimizes the build for the best performance.
- **`npm run preview`**: Serves the production build locally to preview it before deployment.
- **`npm run predeploy`**: Automatically runs before `deploy`. This script typically runs `npm run build` to ensure the production build is up-to-date.
- **`npm run deploy`**: Deploys the production build from the `dist` folder to GitHub Pages using the `gh-pages` package. (Requires a `CNAME` file in `public/` for custom domains).

## How it Works

The application fetches the appropriate JSON files based on the selected game and character under `public/Games/{GameID}/Game.json` and `public/Games/{GameID}/Characters/{CharacterID}.json`. React components render the data directly.

## Internal Move Notation

Moves are stored internally using a generalized notation:

- Directions use the standard numpad notation (1-9).
- Buttons are mapped generically (A, B, C, D, ...).

### Example Mappings (Internal -> Game):

- **SoulCalibur VI:** 8-way run directions, A=A, B=B, K=C, G=D
- **Tekken 8:** (Define mapping as needed)

The goal is to translate this internal notation to the familiar format for each game within the frontend components, allowing players to see inputs as they expect (e.g., Tekken's 1, 2, 3, 4).
