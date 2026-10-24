/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IncomingMessage, Server } from "http";
import type { Duplex } from "stream";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";

type TWebSocketHandler = (ws: WebSocket, req: IncomingMessage) => void;

const normalisePath = (path: string) => {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
};

/**
 * Minimal WebSocket router for the live server. It replaces express-ws, which does not support
 * Express 5. Routes are registered with the same `ws(path, handler)` shape the controller
 * decorators already use, and are matched against the upgrade request's pathname.
 */
export class WebSocketRouter {
  private readonly wss = new WebSocketServer({ noServer: true });
  private readonly routes = new Map<string, TWebSocketHandler>();

  constructor(private readonly basePath: string) {}

  /** Register a handler for `<basePath><path>`; trailing slashes are ignored when matching. */
  readonly ws = (path: string, handler: TWebSocketHandler): void => {
    this.routes.set(normalisePath(`${this.basePath}${path}`), handler);
  };

  /** Route HTTP upgrade requests on `server` to the registered handlers. */
  attach(server: Server): void {
    server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const { pathname } = new URL(req.url ?? "/", "http://localhost");
      const handler = this.routes.get(normalisePath(pathname));
      if (!handler) {
        socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }
      this.wss.handleUpgrade(req, socket, head, (ws) => handler(ws, req));
    });
  }

  close(): void {
    this.wss.close();
  }
}
