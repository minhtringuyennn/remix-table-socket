import { createServer } from "http";
import { createRequestHandler } from "@remix-run/express";
import compression from "compression";
import express from "express";
import morgan from "morgan";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";

const viteDevServer =
  process.env.NODE_ENV === "production"
    ? undefined
    : await import("vite").then((vite) =>
        vite.createServer({
          server: { middlewareMode: true }
        })
      );

const remixHandler = createRequestHandler({
  build: viteDevServer
    ? () => viteDevServer.ssrLoadModule("virtual:remix/server-build")
    : await import("./build/server/index.js")
});

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const __dirname = path.resolve();
const mockDatabase = JSON.parse(fs.readFileSync(path.join(__dirname, "mock.json"), "utf8"));

const userNamespace = io.of("/user");

userNamespace.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("login", (userId) => {
    const user = mockDatabase.users.find((u) => u.user_id === userId);
    if (user) {
      const joinList = [];
      socket.user = user;
      socket.join(`user/${user.user_id}`);
      joinList.push(`user/${user.user_id}`);

      if (user.user_role === "ADMIN") {
        socket.join("admin");
        joinList.push("admin");
      } else if (user.user_role === "BROKER") {
        user.managed_accounts.forEach((account) => {
          socket.join(`user/${account}`);
          joinList.push(`user/${account}`);
        });
      } else if (user.user_role === "BANK") {
        user.managed_banks.forEach((bank) => {
          socket.join(`bank/${bank}`);
          joinList.push(`bank/${bank}`);
        });
      }

      user.watchlist.forEach((stockCode) => {
        socket.join(`stock/${stockCode}`);
        joinList.push(`stock/${stockCode}`);
      });

      console.log(`User ${user.user_id} logged in as ${user.user_role}. Joined: ${joinList.join(", ")}`);
      socket.emit("login success", user);
    } else {
      socket.emit("login failed", "User not found");
    }
  });

  socket.on("subscribe stock", (stockCode) => {
    if (mockDatabase.stocks.some((s) => s.code === stockCode)) {
      socket.join(`stock/${stockCode}`);
      console.log(`Socket ${socket.id} subscribed to stock/${stockCode}`);
      socket.emit("subscribe success", stockCode);
    } else {
      socket.emit("subscribe failed", "Invalid stock code");
    }
  });

  socket.on("unsubscribe stock", (stockCode) => {
    socket.leave(`stock/${stockCode}`);
    console.log(`Socket ${socket.id} unsubscribed from stock/${stockCode}`);
    socket.emit("unsubscribe success", stockCode);
  });
});

// Function to emit order updates with proper filtering
function emitOrderUpdate(order) {
  const { stock_code, user_id, bank_id } = order;

  // Emit to users subscribed to the stock code who are allowed to see this order
  mockDatabase.users.forEach((user) => {
    if (
      user.watchlist.includes(stock_code) &&
      (user.user_role === "ADMIN" ||
        (user.user_role === "BROKER" && user.managed_accounts.includes(user_id)) ||
        (user.user_role === "BANK" && user.managed_banks.includes(bank_id)) ||
        (user.user_role === "CUSTOMER" && user.user_id === user_id))
    ) {
      userNamespace.to(`user/${user.user_id}`).emit("order_update", order);
    }
  });

  // Emit to admin
  userNamespace.to("admin").emit("order_update", order);

  // Emit to the stock code
  userNamespace.to(`stock/${stock_code}`).emit("stock_update", {
    stock_code: stock_code,
    market_price: order.market_price,
    matched_price: order.matched_price
  });

  console.log(`Order update emitted for ${stock_code}, ${user_id}, ${bank_id}`);
}

// Simulate order updates
setInterval(() => {
  const randomStock = mockDatabase.stocks[Math.floor(Math.random() * mockDatabase.stocks.length)];
  const randomUser = mockDatabase.users[Math.floor(Math.random() * mockDatabase.users.length)];
  const order = {
    stock_code: randomStock.code,
    market_price: (Math.random() * 100).toFixed(2),
    matched_price: (Math.random() * 100).toFixed(2),
    user_id: randomUser.user_id,
    bank_id: randomUser.bank_id
  };
  emitOrderUpdate(order);
}, 5000);

app.use(compression());

// handle asset requests
if (viteDevServer) {
  app.use(viteDevServer.middlewares);
} else {
  // Vite fingerprints its assets so we can cache forever.
  app.use("/assets", express.static("build/client/assets", { immutable: true, maxAge: "1y" }));
}

// Everything else (like favicon.ico) is cached for an hour. You may want to be
// more aggressive with this caching.
app.use(express.static("build/client", { maxAge: "1h" }));

app.use(morgan("tiny"));

// handle SSR requests
app.all("*", remixHandler);

const port = process.env.PORT || 3000;

// instead of running listen on the Express app, do it on the HTTP server
httpServer.listen(port, () => {
  console.log(`Express server listening at http://localhost:${port}`);
});
