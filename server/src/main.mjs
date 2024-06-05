//@ts-check

// @ts-ignore
import ngrok from "@ngrok/ngrok";
import { WebSocketServer, WebSocket } from "ws";
import express from "express";
import path from "path";

const CONTROLLER_HTTP_PORT = Number.parseInt(process.env["HAPPLAY_CONTROLLER_HTTP_PORT"] || "8081");
const DEVICE_WS_PORT = Number.parseInt(process.env["HAPPLAY_DEVICE_WS_PORT"] || "8080");

async function main() {
	const app = express();
	const static_path = path.join(import.meta.dirname, "../frontend");
	app.use(express.static(static_path));
	const server = app.listen(CONTROLLER_HTTP_PORT, () => console.log(`Controller started on http://localhost:${CONTROLLER_HTTP_PORT}`));

	const controller_wss = new WebSocketServer({ server, path: "/ws" });
	const device_wss = new WebSocketServer({ port: DEVICE_WS_PORT });

	for (const config of [
		{ rx_wss: controller_wss, name: "controller", tx_wss: device_wss },
		{ rx_wss: device_wss, name: "device", tx_wss: controller_wss },
	]) {
		config.rx_wss.on("connection", (ws, req) => {
			console.log(`${config.name} connected from IP: ${req.socket.remoteAddress}`);

			ws.on("error", err => console.error(err));
			ws.on("close", () => { console.log(`${config.name} disconnected`); });

			ws.on("message", (message, isBinary) => {
				if (isBinary) {
					console.log(`Received ${config.name} binary message => ${message.slice.length} bytes`);
				} else {
					console.log(`Received ${config.name} message => ${message}`);
				}
				config.tx_wss.clients.forEach(client => {
					if (client.readyState === WebSocket.OPEN) {
						client.send(message, { binary: isBinary });
					}
				});
			});

			if (config.name === "device") {
				ws.send(JSON.stringify({ cmd: "getinfo" }));
			}
		});
	}

	console.log(`Oculus websocket server started on port ${DEVICE_WS_PORT}`);
}

await main();