# Tasks for Todoist

View and manage your [Todoist](https://todoist.com) tasks without leaving VS Code.

> Unofficial extension. Not affiliated with or endorsed by Doist.

## Features

A Todoist sidebar with four views:

- **Today**: tasks due today or overdue
- **Upcoming**: tasks due in the next 7 days
- **Inbox**: tasks in your Inbox
- **Projects**: your projects, each expanding to its tasks

Each task shows its due time, an overdue marker, `@labels`, and a priority icon (P1 red flame, P2 orange, P3 blue).

From the view you can:

- **Quick add** a task due today (`+` in the view title)
- **Complete** a task (check icon)
- **Edit**, **reschedule** (natural language, e.g. "next monday", "every friday 5pm") or **delete** a task (right-click)
- **Refresh** manually; views also refresh every 5 minutes and when the window regains focus

## Setup

1. Get your API token in Todoist: **Settings → Integrations → Developer**.
2. Run **Todoist: Set API Token** from the Command Palette (or click the link in the empty view).

Your token is stored in VS Code's encrypted secret storage. It is never written to settings or files, and it is only sent to Todoist.

## Commands

| Command | Description |
|---|---|
| Todoist: Set API Token | Save your token securely |
| Todoist: Refresh Tasks | Reload all views |
| Todoist: Quick Add Task | Add a task due today |

## Development

```
npm install
npm run compile
```

Press F5 to launch an Extension Development Host.

## License

[MIT](LICENSE)
