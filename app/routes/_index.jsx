import { useEffect, useState } from "react";
import { useSocket, useUser } from "../context";

export default function Index() {
  const socket = useSocket();
  const user = useUser();
  const [orders, setOrders] = useState({});

  useEffect(() => {
    if (!socket || !user) return;

    const handleOrderUpdate = (data) => {
      setOrders((prevOrders) => ({
        ...prevOrders,
        [data.stock_code]: data
      }));
    };

    user.watchlist.forEach((stockCode) => {
      socket.emit("subscribe stock", stockCode);
    });

    socket.on("order_update", handleOrderUpdate);
    socket.on("stock_update", handleOrderUpdate);

    return () => {
      socket.off("order_update", handleOrderUpdate);
      socket.off("stock_update", handleOrderUpdate);
    };
  }, [socket, user]);

  const handleStockUnsubscribe = (stockCode) => {
    socket.emit("unsubscribe stock", stockCode);
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8" }}>
      <h1>Real-time Order Updates</h1>

      <div>
        <h3>Watchlist:</h3>
        <ul>
          {user.watchlist.map((stock) => (
            <li key={stock}>
              {stock}
              <button onClick={() => handleStockUnsubscribe(stock)}>Unsubscribe</button>
            </li>
          ))}
        </ul>
      </div>
      <table>
        <thead>
          <tr>
            <th>Stock Code</th>
            <th>Market Price</th>
            <th>Matched Price</th>
            <th>Customer ID</th>
            <th>Bank Account ID</th>
          </tr>
        </thead>
        <tbody>
          {user.watchlist.map((stockCode) => (
            <tr key={stockCode}>
              <td>{stockCode}</td>
              <td>{orders[stockCode]?.market_price || "N/A"}</td>
              <td>{orders[stockCode]?.matched_price || "N/A"}</td>
              <td>{orders[stockCode]?.user_id || "N/A"}</td>
              <td>{orders[stockCode]?.bank_id || "N/A"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
