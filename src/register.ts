/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {ToolDefinition} from './tools/ToolDefinition.js';
import {CallToolResult} from '@modelcontextprotocol/sdk/types.js';
import {Mutex} from './Mutex.js';
import {McpContext} from './McpContext.js';
import {McpResponse} from './McpResponse.js';

const toolMutex = new Mutex();

export interface RegisterToolConfig {
  server: McpServer;
  tool: ToolDefinition;
  getContext: () => Promise<McpContext>;
  logger: debug.Debugger;
}

export function registerTool({
  server,
  tool,
  getContext,
  logger,
}: RegisterToolConfig): void {
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: tool.schema,
      annotations: tool.annotations,
    },
    async (params): Promise<CallToolResult> => {
      const guard = await toolMutex.acquire();
      try {
        logger(`${tool.name} request: ${JSON.stringify(params, null, '  ')}`);
        const context = await getContext();
        const response = new McpResponse();
        await tool.handler(
          {
            params,
          },
          response,
          context,
        );
        try {
          const content = await response.handle(tool.name, context);
          return {
            content,
          };
        } catch (error) {
          const errorText =
            error instanceof Error ? error.message : String(error);

          return {
            content: [
              {
                type: 'text',
                text: errorText,
              },
            ],
            isError: true,
          };
        }
      } finally {
        guard.dispose();
      }
    },
  );
}
