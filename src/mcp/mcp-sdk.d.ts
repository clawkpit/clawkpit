declare module "@modelcontextprotocol/server" {
  export class McpServer {
    constructor(info: { name: string; version: string }, options?: { instructions?: string });
    registerTool(
      name: string,
      config: Record<string, unknown>,
      handler: (args: unknown) => Promise<unknown>
    ): void;
    connect(transport: unknown): Promise<void>;
    close(): Promise<void>;
  }
}

declare module "@modelcontextprotocol/node" {
  export class NodeStreamableHTTPServerTransport {
    constructor(options?: {
      sessionIdGenerator?: (() => string) | undefined;
      enableJsonResponse?: boolean;
    });
    handleRequest(req: unknown, res: unknown, parsedBody?: unknown): Promise<void>;
  }
}
