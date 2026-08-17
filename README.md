# Japanese Song Finder

A web application for finding and exploring Japanese songs based on user input.

## About

This is a web application designed to help users discover Japanese songs by searching for information about songs, artists, and other relevant details.

I created this project to try to make searching for Japanese music easier through a simple, interactive web interface.

## Features

* Search for Japanese songs
* Browse Japanese music based on user input
* Find songs and associated artists
* Interactive web interface
* Fast development environment powered by Vite
* Responsive interface for different screen sizes
* Component-based UI architecture
* Client-side routing

## Technologies

The project currently uses:

* **TypeScript** — Application programming language
* **React / TSX** — User interface
* **Vite** — Development and build tooling
* **Bun** — JavaScript runtime and package manager
* **TanStack Router** — Application routing
* **CSS** — Styling
* **shadcn/ui components** — Reusable interface components

### Prerequisites

Before running the project, make sure you have the following installed:

* [Node.js](https://nodejs.org/)
* [Bun](https://bun.sh/)
* [Visual Studio Code](https://code.visualstudio.com/) (recommended)

> **Note:** This project uses Bun. If you are using Windows and the `bun` command is not recognized, Bun needs to be installed and added to your system PATH.

### 1. Clone the repository

Open a terminal and run:

```bash
git clone https://github.com/ZShakes/japanese-song-finder.git
```

Then move into the project directory:

```bash
cd japanese-song-finder
```

### 2. Install Bun

If Bun is not already installed, follow the installation instructions on the official Bun website:

https://bun.sh/

After installing Bun, verify that it is working:

```bash
bun --version
```

If a version number is displayed, Bun is installed correctly.

### 3. Install dependencies

From inside the project directory, run:

```bash
bun install
```

This installs the dependencies specified by the project's `package.json`.

### 4. Start the development server

Run:

```bash
bun run dev
```

Vite should start a local development server.

The terminal will display a local URL. Open that address in your browser.

## Running the Project in VS Code

You can also run the project entirely from Visual Studio Code.

### Step 1 — Open the repository

In VS Code, select:

**File → Open Folder**

and choose the `japanese-song-finder` folder.

### Step 2 — Open the terminal

Select:

**Terminal → New Terminal**

### Step 3 — Install dependencies

Run:

```bash
bun install
```

### Step 4 — Start the application

Run:

```bash
bun run dev
```

### Step 5 — Open the website

VS Code will display the local development URL in the terminal.

Open that URL in your browser to use the application.

## Useful Commands

| Command           | Purpose                         |
| ----------------- | ------------------------------- |
| `bun install`     | Install project dependencies    |
| `bun run dev`     | Start the development server    |
| `bun run build`   | Create a production build       |
| `bun run preview` | Preview the production build    |
| `bun --version`   | Check the installed Bun version |

## Troubleshooting

### `bun is not recognized`

If Windows displays an error such as:

```text
'bun' is not recognized as an internal or external command
```

Bun is either not installed or its installation directory is not included in your PATH.

First install Bun from:

https://bun.sh/

Then close and reopen VS Code and check:

```bash
bun --version
```

If it still does not work, restart Windows and try again.

### Dependencies are missing

If you receive errors about missing packages, run:

```bash
bun install
```

Then restart the development server:

```bash
bun run dev
```

### Port already in use

If the default development port is already being used, Vite may automatically select another available port. Check the terminal output for the correct local URL.

## Contributing

Contributions, suggestions, and improvements are welcome.

To contribute:

1. Fork the repository.
2. Create a new branch.

```bash
git checkout -b feature/my-new-feature
```

3. Make your changes.
4. Test the application locally.
5. Commit your changes.

```bash
git add .
git commit -m "Add new feature"
```

6. Push the branch.

```bash
git push origin feature/my-new-feature
```

7. Open a pull request.

## Future Improvements

Potential future improvements include:

* [ ] Expand the Japanese song database
* [ ] Add more advanced search filters
* [ ] Search by artist
* [ ] Search by album
* [ ] Add song previews
* [ ] Add links to streaming services
* [ ] Add song popularity information
* [ ] Add Japanese/English language support
* [ ] Improve mobile support
* [ ] Add user favorites
* [ ] Add playlists
* [ ] Add additional music APIs

## License

A license has not yet been specified for this repository.

## Author

**Zachary Shakes**

GitHub:
https://github.com/ZShakes
