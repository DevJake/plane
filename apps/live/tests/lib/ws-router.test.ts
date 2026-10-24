/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { createServer } from "http";
import type { Server } from "http";
import net from "net";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocketRouter } from "@/lib/ws-router";

let server: Server | undefined;
let router: WebSocketRouter | undefined;

afterEach(async () => {
  router?.close();
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
  router = undefined;
});

const start = async (basePath: string, routePath = "/collaboration/") => {
  router = new WebSocketRouter(basePath);
  let connected = 0;
  router.ws(routePath, (ws) => {
    connected++;
    ws.close();
  });
  server = createServer();
  router.attach(server);
  await new Promise<void>((resolve) => server!.listen(0, resolve));
  const { port } = server.address() as net.AddressInfo;
  return { port, connected: () => connected };
};

/** Send a raw upgrade request and resolve with the status line once the server closes the socket. */
const upgrade = (port: number, target: string) =>
  new Promise<{ statusLine: string; closed: boolean }>((resolve) => {
    const socket = net.connect(port, "127.0.0.1", () => {
      socket.write(
        `GET ${target} HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n`
      );
    });
    let data = "";
    socket.on("data", (chunk) => (data += chunk));
    socket.on("error", () => undefined);
    const timer = setTimeout(() => {
      resolve({ statusLine: data.split("\r\n")[0], closed: false });
      socket.destroy();
    }, 1500);
    socket.on("close", () => {
      clearTimeout(timer);
      resolve({ statusLine: data.split("\r\n")[0], closed: true });
    });
  });

describe("WebSocketRouter", () => {
  it("upgrades a registered path", async () => {
    const { port, connected } = await start("/live");
    expect((await upgrade(port, "/live/collaboration")).statusLine).toContain("101");
    expect(connected()).toBe(1);
  });

  it("ignores a trailing slash and the query string", async () => {
    const { port } = await start("/live");
    expect((await upgrade(port, "/live/collaboration/?token=1")).statusLine).toContain("101");
  });

  it("answers 404 for an unknown path and closes the socket", async () => {
    const { port } = await start("/live");
    const result = await upgrade(port, "/live/nope");
    expect(result.statusLine).toContain("404");
    expect(result.closed).toBe(true);
  });

  it.each(["/", "/live/", "/live"])("joins base path %s with the route without duplicate slashes", async (base) => {
    const { port } = await start(base);
    const target = base === "/" ? "/collaboration" : `${base.replace(/\/$/, "")}/collaboration`;
    expect((await upgrade(port, target)).statusLine).toContain("101");
  });

  it.each(["http://h:99999/live/collaboration", "http://[/x"])(
    "answers 400 and closes the socket for the malformed URL %s",
    async (target) => {
      const { port } = await start("/live");
      const result = await upgrade(port, target);
      expect(result.statusLine).toContain("400");
      expect(result.closed).toBe(true);
    }
  );
});
