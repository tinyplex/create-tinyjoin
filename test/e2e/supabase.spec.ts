import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { expect, test } from "@playwright/test";
import { type RawData, WebSocket, WebSocketServer } from "ws";

const mockPort = 4176;
const publishableKey = "sb_publishable_create_tinygres_e2e";
const subscriptionId = 47;
const supabaseAppUrl = "http://127.0.0.1:4175";

const initialRows: SnapshotRow[] = [
  {
    id: 1,
    title: "The first row came from Supabase",
    published: true,
  },
  {
    id: 2,
    title: "Realtime will replace this title",
    published: true,
  },
  {
    id: 3,
    title: "Drafts remain filtered locally",
    published: false,
  },
];

test("the generated Supabase starter snapshots and invalidates through Realtime", async ({
  page,
}) => {
  const server = await startSupabaseServer();
  try {
    await page.goto(supabaseAppUrl);

    await expect(page.getByTestId("state")).toHaveText("Ready");
    await expect(page.getByTestId("sync-phase")).toHaveText("live-best-effort");
    await expect(page.getByTestId("status")).toHaveText(
      "Supabase snapshot reconciled. Realtime invalidations are live.",
    );
    await expect(page.getByTestId("revision")).toHaveText("1");
    await expect(page.locator("[data-post-id]")).toHaveCount(2);
    await expect(page.locator('[data-post-id="2"]')).toContainText(
      "Realtime will replace this title",
    );
    await expect(page.getByTestId("error")).toBeHidden();

    expect(server.restRequests).toEqual([
      expectedRestRequest("0-499"),
      expectedRestRequest("3-502"),
    ]);
    expect(server.sessions).toHaveLength(1);
    const session = server.sessions[0]!;
    expect(session.endpoint).toEqual({
      apikey: publishableKey,
      path: "/realtime/v1/websocket",
      vsn: "1.0.0",
    });
    expect(session.join.payload).toMatchObject({
      config: {
        broadcast: { ack: false, replication_ready: true, self: false },
        presence: { enabled: false },
        private: false,
        postgres_changes: [
          {
            event: "*",
            schema: "public",
            table: "tinygres_posts",
            select: ["id", "title", "published"],
          },
        ],
      },
    });

    const invalidationsBeforeUpdate = Number(
      await page.getByTestId("invalidations").textContent(),
    );
    expect(Number.isSafeInteger(invalidationsBeforeUpdate)).toBe(true);

    sendUpdate(session, {
      id: 2,
      title: "Updated through Supabase Realtime",
      published: true,
    });

    await expect(page.getByTestId("invalidations")).toHaveText(
      String(invalidationsBeforeUpdate + 1),
    );
    await expect(page.getByTestId("revision")).toHaveText("2");
    await expect(page.locator('[data-post-id="2"]')).toContainText(
      "Updated through Supabase Realtime",
    );
    await expect(page.getByTestId("status")).toHaveText(
      "Re-queried tinygres_posts after invalidation at revision 2.",
    );
    await expect(page.getByTestId("sync-phase")).toHaveText("live-best-effort");
    await expect(page.getByTestId("error")).toBeHidden();
  } finally {
    await page.goto("about:blank").catch(() => undefined);
    await server.close();
  }
});

type SnapshotRow = {
  id: number;
  published: boolean;
  title: string;
};

type RestRequest = {
  acceptProfile: string | undefined;
  apikey: string | undefined;
  authorization: string | undefined;
  order: string | null;
  range: string | undefined;
  rangeUnit: string | undefined;
  select: string | null;
};

type PhoenixMessage = {
  event: string;
  join_ref: string | null;
  payload: Record<string, unknown>;
  ref: string | null;
  topic: string;
};

type RealtimeSession = {
  endpoint: {
    apikey: string | null;
    path: string;
    vsn: string | null;
  };
  join: PhoenixMessage & { ref: string };
  socket: WebSocket;
};

type SupabaseServer = {
  close(): Promise<void>;
  restRequests: RestRequest[];
  sessions: RealtimeSession[];
};

async function startSupabaseServer(): Promise<SupabaseServer> {
  const restRequests: RestRequest[] = [];
  const sessions: RealtimeSession[] = [];
  const webSockets = new WebSocketServer({ noServer: true });
  const http = createServer((request, response) => {
    handlePostgrest(request, response, restRequests);
  });

  http.on("upgrade", (request, socket, head) => {
    const endpoint = new URL(request.url ?? "/", "http://localhost");
    if (endpoint.pathname !== "/realtime/v1/websocket") {
      socket.destroy();
      return;
    }
    webSockets.handleUpgrade(request, socket, head, (webSocket) => {
      webSockets.emit("connection", webSocket, request);
    });
  });
  webSockets.on("connection", (socket, request) => {
    installRealtimeSession(socket, request, sessions);
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => reject(error);
    http.once("error", onError);
    http.listen(mockPort, "127.0.0.1", () => {
      http.off("error", onError);
      resolve();
    });
  });

  return {
    restRequests,
    sessions,
    async close() {
      for (const socket of webSockets.clients) {
        socket.terminate();
      }
      await new Promise<void>((resolve, reject) => {
        webSockets.close((error) => (error ? reject(error) : resolve()));
      });
      await new Promise<void>((resolve, reject) => {
        http.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

function handlePostgrest(
  request: IncomingMessage,
  response: ServerResponse,
  requests: RestRequest[],
): void {
  const corsHeaders = {
    "Access-Control-Allow-Headers":
      "accept, accept-profile, apikey, authorization, range, range-unit",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Origin": "*",
  };
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders);
    response.end();
    return;
  }

  const url = new URL(request.url ?? "/", "http://localhost");
  if (request.method !== "GET" || url.pathname !== "/rest/v1/tinygres_posts") {
    response.writeHead(404, corsHeaders);
    response.end();
    return;
  }

  const restRequest = {
    acceptProfile: header(request, "accept-profile"),
    apikey: header(request, "apikey"),
    authorization: header(request, "authorization"),
    order: url.searchParams.get("order"),
    range: header(request, "range"),
    rangeUnit: header(request, "range-unit"),
    select: url.searchParams.get("select"),
  };
  requests.push(restRequest);

  const from = Number.parseInt(restRequest.range?.split("-", 1)[0] ?? "", 10);
  const rows =
    from === 0 ? initialRows : from === initialRows.length ? [] : undefined;
  if (!rows) {
    response.writeHead(500, {
      ...corsHeaders,
      "Content-Type": "application/json",
    });
    response.end(
      JSON.stringify({
        message: `Unexpected snapshot range ${restRequest.range}`,
      }),
    );
    return;
  }

  response.writeHead(200, {
    ...corsHeaders,
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(rows));
}

function installRealtimeSession(
  socket: WebSocket,
  request: IncomingMessage,
  sessions: RealtimeSession[],
): void {
  const endpoint = new URL(request.url ?? "/", "http://localhost");
  socket.on("message", (data) => {
    const message = parsePhoenixMessage(data);
    if (message.event === "heartbeat") {
      socket.send(
        JSON.stringify({
          topic: "phoenix",
          event: "phx_reply",
          payload: { status: "ok", response: {} },
          ref: message.ref,
          join_ref: null,
        }),
      );
      return;
    }
    if (message.event !== "phx_join" || typeof message.ref !== "string") {
      return;
    }

    sessions.push({
      endpoint: {
        apikey: endpoint.searchParams.get("apikey"),
        path: endpoint.pathname,
        vsn: endpoint.searchParams.get("vsn"),
      },
      join: { ...message, ref: message.ref },
      socket,
    });
    socket.send(
      JSON.stringify({
        topic: message.topic,
        event: "phx_reply",
        payload: {
          status: "ok",
          response: {
            postgres_changes: [
              {
                id: subscriptionId,
                event: "*",
                schema: "public",
                table: "tinygres_posts",
              },
            ],
          },
        },
        ref: message.ref,
        join_ref: message.ref,
      }),
    );
    for (const payload of [
      {
        status: "ok",
        extension: "postgres_changes",
        message: "Subscribed to PostgreSQL",
      },
      {
        status: "ok",
        extension: "system",
        message: "Replication connection established",
      },
    ]) {
      socket.send(
        JSON.stringify({
          topic: message.topic,
          event: "system",
          payload: { ...payload, channel: message.topic },
          ref: null,
          join_ref: message.ref,
        }),
      );
    }
  });
  socket.on("error", () => undefined);
}

function sendUpdate(session: RealtimeSession, row: SnapshotRow): void {
  session.socket.send(
    JSON.stringify({
      topic: session.join.topic,
      event: "postgres_changes",
      payload: {
        ids: [subscriptionId],
        data: {
          schema: "public",
          table: "tinygres_posts",
          type: "UPDATE",
          record: row,
          old_record: initialRows.find(({ id }) => id === row.id),
          commit_timestamp: "2026-08-12T00:00:00.000Z",
          errors: null,
        },
      },
      ref: null,
      join_ref: session.join.ref,
    }),
  );
}

function parsePhoenixMessage(value: RawData): PhoenixMessage {
  return JSON.parse(value.toString()) as PhoenixMessage;
}

function expectedRestRequest(range: string): RestRequest {
  return {
    acceptProfile: "public",
    apikey: publishableKey,
    authorization: undefined,
    order: "id.asc",
    range,
    rangeUnit: "items",
    select: "id,title,published",
  };
}

function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value.join(", ") : value;
}
