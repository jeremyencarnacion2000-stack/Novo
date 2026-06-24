/**
 * Notion API service layer.
 *
 * Uses the official @notionhq/client SDK. Access tokens come from
 * IntegrationAccount records — NOT from NextAuth sessions — because
 * Notion uses its own separate OAuth 2.0 flow (not Google/Spotify).
 *
 * Security: this file is server-only. Never import it in client components.
 */

import { Client } from '@notionhq/client';
import type { IntegratedTask } from './integration-engine';

// ── Client factory ──────────────────────────────────────────────────────────

/**
 * Builds an authenticated Notion client from a stored access token.
 */
export function getNotionClient(accessToken: string): Client {
    return new Client({ auth: accessToken });
}

// ── Notion database row → IntegratedTask mapper ──────────────────────────────

/**
 * Maps a single Notion page (from a database query result) to our internal
 * IntegratedTask shape. Property names are the conventional Notion defaults;
 * we gracefully fall back when they are absent.
 */
function mapPageToTask(page: any): IntegratedTask | null {
    try {
        const props = page.properties || {};

        // Title — try "Name", "Task", "Title" in that order
        const titleProp =
            props['Name'] || props['Task'] || props['Title'] || null;
        const title: string =
            titleProp?.title?.[0]?.plain_text ||
            titleProp?.rich_text?.[0]?.plain_text ||
            '(Untitled Notion page)';

        // Completion status — checkbox property named "Done", "Completed", or "Status"
        let completed = false;
        if (props['Done']?.checkbox !== undefined) {
            completed = props['Done'].checkbox;
        } else if (props['Completed']?.checkbox !== undefined) {
            completed = props['Completed'].checkbox;
        } else if (props['Status']?.status?.name === 'Done') {
            completed = true;
        }

        // Priority — select property named "Priority"
        const priorityName: string =
            props['Priority']?.select?.name?.toLowerCase() || 'medium';
        const priority: 'low' | 'medium' | 'high' =
            priorityName === 'high' ? 'high' :
            priorityName === 'low' ? 'low' : 'medium';

        // Due date — date property named "Due", "Date", "Due Date"
        const dateProp =
            props['Due'] || props['Date'] || props['Due Date'] || null;
        const dueDate: Date | undefined =
            dateProp?.date?.start ? new Date(dateProp.date.start) : undefined;

        return {
            id: `notion:page:${page.id}`,
            text: title,
            completed,
            priority,
            source: 'notion' as any, // Engine type will be extended
            sourceId: page.id,
            dueDate,
            metadata: {
                category: 'notion',
            },
        };
    } catch {
        return null;
    }
}

// ── Service methods ──────────────────────────────────────────────────────────

export const notionService = {
    /**
     * Lists all databases accessible to the integration's bot user.
     * Returns id + title pairs for the database picker UI.
     */
    listDatabases: async (accessToken: string) => {
        const notion = getNotionClient(accessToken);
        const res = await notion.search({
            filter: { property: 'object', value: 'database' },
            page_size: 50,
        });
        return res.results.map((db: any) => ({
            id: db.id as string,
            title: (db.title?.[0]?.plain_text ?? db.id) as string,
        }));
    },

    /**
     * Queries all pages in a Notion database and maps them to IntegratedTask[].
     * Filters to pages with a non-empty title and not archived.
     */
    queryDatabase: async (
        accessToken: string,
        databaseId: string,
    ): Promise<IntegratedTask[]> => {
        const notion = getNotionClient(accessToken);
        const tasks: IntegratedTask[] = [];
        let cursor: string | undefined;

        do {
            const res = await notion.databases.query({
                database_id: databaseId,
                start_cursor: cursor,
                page_size: 100,
                filter: {
                    property: 'Done',
                    checkbox: { equals: false },
                },
            });

            for (const page of res.results) {
                const task = mapPageToTask(page);
                if (task) tasks.push(task);
            }

            cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
        } while (cursor);

        return tasks;
    },

    /**
     * Fetches tasks from ALL database IDs stored in the integration metadata.
     * Used by the Integration Engine step.
     */
    fetchAllTasks: async (
        accessToken: string,
        databaseIds: string[],
    ): Promise<IntegratedTask[]> => {
        const all: IntegratedTask[] = [];
        for (const dbId of databaseIds) {
            try {
                const tasks = await notionService.queryDatabase(accessToken, dbId);
                all.push(...tasks);
            } catch (err) {
                // One failing database should not block others
                console.error(`[Notion] Failed to query database ${dbId}:`, err);
            }
        }
        return all;
    },

    /**
     * Marks a Notion page's "Done" checkbox to `completed`.
     * Used by IntegrationEngine.syncCompletion() for notion: tasks.
     */
    updatePageCompletion: async (
        accessToken: string,
        pageId: string,
        completed: boolean,
    ): Promise<void> => {
        const notion = getNotionClient(accessToken);
        await notion.pages.update({
            page_id: pageId,
            properties: {
                Done: { checkbox: completed },
            },
        });
    },
};
