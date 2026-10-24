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
  const trimmed = path.replace(/\/{2,}/g, "/").replace(/\/+$/, "");
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
    // Node gives an upgrade handler the raw socket with no error handling, so anything thrown here would
    // leak it; reject with a status line and destroy the socket instead.
    const reject = (socket: Duplex, statusLine: string) => {
      socket.write(`HTTP/1.1 ${statusLine}\r\nConnection: close\r\n\r\n`);
      socket.destroy();
    };
    server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      try {
        let pathname: string;
        try {
          ({ pathname } = new URL(req.url ?? "/", "http://localhost"));
        } catch {
          reject(socket, "400 Bad Request");
          return;
        }
        const handler = this.routes.get(normalisePath(pathname));
        if (!handler) {
          reject(socket, "404 Not Found");
          return;
        }
        this.wss.handleUpgrade(req, socket, head, (ws) => handler(ws, req));
      } catch {
        reject(socket, "500 Internal Server Error");
      }
    });
  }

  close(): void {
    this.wss.close();
  }
}
