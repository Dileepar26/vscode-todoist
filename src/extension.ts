import * as vscode from 'vscode';
import { TodoistApi } from '@doist/todoist-sdk';
import { TodoistTreeProvider, TodoistTaskItem, byFilter } from './todoistProvider';

const TOKEN_SECRET_KEY = 'todoist_personal_api_token';

export function activate(context: vscode.ExtensionContext) {
  // Helper to get an authenticated client
  async function getClient(): Promise<TodoistApi | null> {
    const token = await context.secrets.get(TOKEN_SECRET_KEY);
    if (!token) {
      return null;
    }
    return new TodoistApi(token);
  }

  const providers = {
    todoistTodayView: new TodoistTreeProvider(getClient, byFilter('today | overdue')),
    todoistUpcomingView: new TodoistTreeProvider(getClient, byFilter('next 7 days')),
    todoistInboxView: new TodoistTreeProvider(getClient, byFilter('#Inbox')),
    todoistProjectsView: new TodoistTreeProvider(getClient, null, true),
  };
  for (const [viewId, p] of Object.entries(providers)) {
    vscode.window.registerTreeDataProvider(viewId, p);
  }
  const provider = {
    refresh: () => Object.values(providers).forEach((p) => p.refresh()),
  };

  // Drives the "set token" welcome message in the empty view
  async function updateTokenContext() {
    const token = await context.secrets.get(TOKEN_SECRET_KEY);
    await vscode.commands.executeCommand('setContext', 'todoist.hasToken', !!token);
  }
  updateTokenContext();

  // Auto-refresh every 5 minutes and whenever the window regains focus
  const refreshTimer = setInterval(() => provider.refresh(), 5 * 60 * 1000);
  context.subscriptions.push(
    { dispose: () => clearInterval(refreshTimer) },
    vscode.window.onDidChangeWindowState((state) => {
      if (state.focused) {
        provider.refresh();
      }
    })
  );

  // Command: Set API Token securely in VS Code's encrypted storage
  context.subscriptions.push(
    vscode.commands.registerCommand('todoist.setToken', async () => {
      const token = await vscode.window.showInputBox({
        prompt: 'Enter your Todoist API token (from Todoist Settings > Integrations > Developer)',
        password: true,
        ignoreFocusOut: true,
      });

      if (token) {
        await context.secrets.store(TOKEN_SECRET_KEY, token.trim());
        vscode.window.showInformationMessage('Todoist API token saved!');
        await updateTokenContext();
        provider.refresh();
      }
    })
  );

  // Command: Refresh task list
  context.subscriptions.push(
    vscode.commands.registerCommand('todoist.refresh', () => {
      provider.refresh();
    })
  );

  // Command: Quick Add Task
  context.subscriptions.push(
    vscode.commands.registerCommand('todoist.addTask', async () => {
      const api = await getClient();
      if (!api) {
        const action = await vscode.window.showWarningMessage(
          'API token not configured.',
          'Set Token'
        );
        if (action === 'Set Token') {
          vscode.commands.executeCommand('todoist.setToken');
        }
        return;
      }

      const input = await vscode.window.showInputBox({
        prompt: 'Add task to Today (e.g., "Review pull request")',
        placeHolder: 'Task title...',
      });

      if (input && input.trim()) {
        try {
          await api.addTask({
            content: input.trim(),
            dueString: 'today',
          });
          vscode.window.showInformationMessage('Task added!');
          provider.refresh();
        } catch (error: any) {
          vscode.window.showErrorMessage(`Failed to add task: ${error.message || error}`);
        }
      }
    })
  );

  // Command: Check off / Complete task
  context.subscriptions.push(
    vscode.commands.registerCommand('todoist.completeTask', async (item: TodoistTaskItem) => {
      const api = await getClient();
      if (!api || !item?.task?.id) {
        return;
      }

      try {
        await api.closeTask(item.task.id);
        vscode.window.showInformationMessage(`Completed: "${item.task.content}"`);
        provider.refresh();
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to complete task: ${error.message || error}`);
      }
    })
  );

  // Command: Edit task title
  context.subscriptions.push(
    vscode.commands.registerCommand('todoist.editTask', async (item: TodoistTaskItem) => {
      const api = await getClient();
      if (!api || !item?.task?.id) {
        return;
      }
      const content = await vscode.window.showInputBox({
        prompt: 'Edit task',
        value: item.task.content,
      });
      if (content && content.trim() && content.trim() !== item.task.content) {
        try {
          await api.updateTask(item.task.id, { content: content.trim() });
          provider.refresh();
        } catch (error: any) {
          vscode.window.showErrorMessage(`Failed to edit task: ${error.message || error}`);
        }
      }
    })
  );

  // Command: Reschedule task using Todoist's natural-language dates
  context.subscriptions.push(
    vscode.commands.registerCommand('todoist.rescheduleTask', async (item: TodoistTaskItem) => {
      const api = await getClient();
      if (!api || !item?.task?.id) {
        return;
      }
      const dueString = await vscode.window.showInputBox({
        prompt: 'New due date (e.g., "tomorrow", "next monday", "every friday 5pm")',
        value: item.task.due?.string ?? '',
      });
      if (dueString && dueString.trim()) {
        try {
          await api.updateTask(item.task.id, { dueString: dueString.trim() });
          provider.refresh();
        } catch (error: any) {
          vscode.window.showErrorMessage(`Failed to reschedule task: ${error.message || error}`);
        }
      }
    })
  );

  // Command: Delete task (confirmed first)
  context.subscriptions.push(
    vscode.commands.registerCommand('todoist.deleteTask', async (item: TodoistTaskItem) => {
      const api = await getClient();
      if (!api || !item?.task?.id) {
        return;
      }
      const confirm = await vscode.window.showWarningMessage(
        `Delete "${item.task.content}"? This cannot be undone.`,
        { modal: true },
        'Delete'
      );
      if (confirm !== 'Delete') {
        return;
      }
      try {
        await api.deleteTask(item.task.id);
        provider.refresh();
      } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to delete task: ${error.message || error}`);
      }
    })
  );
}

export function deactivate() {}