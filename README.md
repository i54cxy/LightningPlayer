# Summary

This project is given this name because it was "lightning fast" to implement. Before, I wouldn't dare dig into a rabbit hole such as video processing/playback, or Rust, or desktop app development. However, as I researched and with the help of LLMs, it became apparent that developing a video player on Windows is now pretty easy for a web developer.

The app works as follows:

- Tauri is used and only used for window creation. The app itself should be fully compatible in a web browser once you serve it using vite. There are no IPC or any rust commands.
- Frontend is written in TypeScript React 19.1, though no new features are used except for the React Compiler.
- Routing is done with React Router's [data mode](https://reactrouter.com/start/modes#data).
- Styling is done with [Emotion](https://emotion.sh/docs/introduction).
- Icons are Fluent UI System Icons downloaded from [Icônes](https://github.com/antfu-collective/icones), though I'm no designer and just picked whatever that didn't hurt my eyes.
- Media files are read with the web File API, demuxed with [Mediabunny](https://mediabunny.dev/), decoded with the WebCodecs API, then rendered onto a canvas.

Honestly, the best way to get to know this project might be to ask your AI agent of choice to have a go at my `CLAUDE.md` (or read it yourself).

# Machine Setup

Follow the [Tauri documentation](https://v2.tauri.app/start/prerequisites/) to install all dependencies.

Install Node.js since we're using React. The current version in use is `v22.20.0`.

Install pnpm following their [official docs](https://pnpm.io/installation).

# Running the program

Run

```
pnpm install
```

then

```
pnpm tauri dev
```

## Dev Ex

VS Code's `settings.json`:

```
"rust-analyzer.cargo.targetDir": "${workspaceFolder}/src-tauri/target"
```
