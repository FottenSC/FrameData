# Soul Calibur VI Frame Data Viewer

This is a web application designed to display frame data for characters in the game Soul Calibur VI. It uses React, Vite, TypeScript, and SQL.js to load and display move lists from an SQLite database file directly in the browser.

## Features

*   Displays character move lists in a sortable, filterable table.
*   Loads data from a local `Framedata.db` file using SQL.js.
*   Built with modern web technologies for a fast and responsive experience.

## Tech Stack

*   **Frontend:** React, TypeScript
*   **Build Tool:** Vite
*   **Styling:** Tailwind CSS, shadcn/ui
*   **Table:** TanStack Table
*   **Database:** SQL.js (running SQLite in the browser)

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
    *   Ensure you have the `Framedata.db` file in the `public/` directory of the project. This file contains the character move data.
    *   The application expects `sql-wasm.wasm` to be available. It's usually loaded via CDN or should be placed in the `public/` directory if self-hosted.

## Available Scripts

*   **`npm run dev`**: Runs the app in development mode with hot reloading. Open [http://localhost:5173](http://localhost:5173) (or the port specified by Vite) to view it in the browser.
*   **`npm run build`**: Builds the app for production to the `dist` folder. It correctly bundles React in production mode and optimizes the build for the best performance.
*   **`npm run preview`**: Serves the production build locally to preview it before deployment.

## How it Works

The application initializes SQL.js in the browser, fetches the `Framedata.db` file, and loads it into the SQL.js engine. React components then query this in-browser database to display the frame data using TanStack Table. 


## Moves are stored with the industry standard move language 
Each direction has a number based on the numpad
Each button is mapped to 
ABCDEFG

So for calibur its simple 
* 8 way run stays
* A=A B=B K=C G=D

In the frontend everything will be translated to the format users expect
so tekken players can keep their wonderful inputs system :)