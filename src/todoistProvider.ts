import * as vscode from 'vscode';
import { TodoistApi, Task } from '@doist/todoist-sdk';

type Project = Awaited<ReturnType<TodoistApi['getProjects']>>['results'][number];

export class TodoistTaskItem extends vscode.TreeItem {
  constructor(public readonly task: Task) {
    super(task.content, vscode.TreeItemCollapsibleState.None);
    
    this.tooltip = task.description || task.content;
    this.contextValue = 'todoistTask';
    this.description = describeTask(task);

    // Todoist API priority is inverted: 4 = P1 (urgent), 1 = P4 (default)
    const priorityColors: Record<number, string> = {
      4: 'charts.red',
      3: 'charts.orange',
      2: 'charts.blue',
    };
    const color = priorityColors[task.priority];
    this.iconPath = color
      ? new vscode.ThemeIcon(task.priority === 4 ? 'flame' : 'circle-filled', new vscode.ThemeColor(color))
      : new vscode.ThemeIcon('circle-outline');
  }
}

function describeTask(task: Task): string {
  const parts: string[] = [];
  if (task.due) {
    if (task.due.datetime) {
      parts.push(new Date(task.due.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
    if (task.due.date < new Date().toLocaleDateString('en-CA')) {
      parts.push('overdue');
    }
  }
  parts.push(...task.labels.map((label) => `@${label}`));
  return parts.join(' · ');
}

export class TodoistProjectItem extends vscode.TreeItem {
  constructor(public readonly project: Project) {
    super(project.name, vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon('folder');
    this.contextValue = 'todoistProject';
  }
}

type Node = TodoistTaskItem | TodoistProjectItem;
type TaskLoader = (api: TodoistApi) => Promise<Task[]>;

/** Collects every page of a cursor-paginated Todoist response. */
export async function fetchAll<T>(
  page: (cursor: string | null) => Promise<{ results: T[]; nextCursor: string | null }>
): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | null = null;
  do {
    const res = await page(cursor);
    all.push(...res.results);
    cursor = res.nextCursor;
  } while (cursor);
  return all;
}

export const byFilter = (query: string): TaskLoader => (api) =>
  fetchAll((cursor) => api.getTasksByFilter({ query, cursor }));

/** Flat task list (Today, Upcoming, Inbox) or, with groupByProject, projects containing their tasks. */
export class TodoistTreeProvider implements vscode.TreeDataProvider<Node> {
  private _onDidChangeTreeData = new vscode.EventEmitter<Node | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private getClient: () => Promise<TodoistApi | null>,
    private loadTasks: TaskLoader | null,
    private groupByProject = false
  ) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: Node): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: Node): Promise<Node[]> {
    const api = await this.getClient();
    if (!api) {
      return [];
    }

    try {
      if (this.groupByProject) {
        if (element instanceof TodoistProjectItem) {
          const tasks = await fetchAll((cursor) =>
            api.getTasks({ projectId: element.project.id, cursor })
          );
          return tasks.map((task) => new TodoistTaskItem(task));
        }
        const projects = await fetchAll((cursor) => api.getProjects({ cursor }));
        return projects.map((project) => new TodoistProjectItem(project));
      }

      const tasks = await this.loadTasks!(api);
      return tasks.map((task) => new TodoistTaskItem(task));
    } catch (error: any) {
      vscode.window.showErrorMessage(`Todoist error: ${error.message || error}`);
      return [];
    }
  }
}
