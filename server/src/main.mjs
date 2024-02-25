import ngrok from "@ngrok/ngrok";
import { WebSocketServer } from "ws";


async function main() {
	const wss = new WebSocketServer({ port: 8080 });

	wss.on("connection", (ws, req) => {
		console.log(`Client connected with IP: ${req.socket.remoteAddress}`);
		ws.on("error", err => console.error(err));

		ws.on("message", message => {
			console.log(`Received message => ${message}`);
		});

		ws.send("hello dear client");
	});

	console.log("Server started on port 8080");
}

await main();