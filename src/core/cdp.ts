type CdpResponse = {
  id?: number;
  result?: Record<string, unknown> & {
    result?: { value?: unknown };
    exceptionDetails?: { text?: string };
  };
  error?: { message?: string };
};

export async function cdpCommand<T>(webSocketUrl: string, method: string, params: Record<string, unknown> = {}): Promise<T> {
  const Socket = (globalThis as unknown as { WebSocket: new (url: string) => {
    addEventListener(type: string, listener: (event: { data?: string }) => void): void;
    send(data: string): void;
    close(): void;
  } }).WebSocket;
  const socket = new Socket(webSocketUrl);

  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve());
    socket.addEventListener("error", () => reject(new Error("Unable to connect to browser CDP.")));
  });

  try {
    const response = await new Promise<CdpResponse>((resolve, reject) => {
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(String(event.data ?? "")) as CdpResponse;
        if (message.id === 1) resolve(message);
      });
      socket.addEventListener("error", () => reject(new Error("Browser CDP request failed.")));
      socket.send(JSON.stringify({
        id: 1,
        method,
        params
      }));
    });
    const error = response.error?.message ?? response.result?.exceptionDetails?.text;
    if (error) throw new Error(error);
    return response.result as T;
  } finally {
    socket.close();
  }
}

export async function cdpEvaluate<T>(webSocketUrl: string, expression: string): Promise<T> {
  const response = await cdpCommand<{ result?: { value?: unknown } }>(webSocketUrl, "Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  return response.result?.value as T;
}

export async function findCdpPage(port: number, urlIncludes: string): Promise<string | null> {
  try {
    const targets = (await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json())) as Array<{
      type?: string;
      url?: string;
      webSocketDebuggerUrl?: string;
    }>;
    return targets.find((target) => target.type === "page" && target.url?.includes(urlIncludes))?.webSocketDebuggerUrl ?? null;
  } catch {
    return null;
  }
}
