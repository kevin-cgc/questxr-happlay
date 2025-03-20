import { ALT_WSS_HOST, SAMPLE_RATE } from "./appmode.mjs";

const serverwslog = document.getElementById("serverwslog");
function log_to_logcontainer(message, logcontainer) {
	const msglog = logcontainer.querySelector(".msglog");
	const div = document.createElement("div");
	div.className = "logmsg";
	div.textContent = message;
	msglog.appendChild(div);
	div.scrollIntoView();
}
export const swslog = msg => log_to_logcontainer(msg, serverwslog);

const url = new URL(location.href);
const create_websocket = () => {
	if (ALT_WSS_HOST) {
		return new WebSocket(`wss://${ALT_WSS_HOST}/ws`);
	}
	const ws = new WebSocket(`${url.protocol == "https:" ? "wss" : "ws" }://${url.host}/ws`);
	// ws.binaryType = "arraybuffer";
	return ws;
}
let ws = create_websocket();

export const send_ws_msg = msg => {
	swslog(`Sending message => ${JSON.stringify(msg)}`);
	ws.send(JSON.stringify(msg));
};

/**
 *
 * @param {Float32Array} pcm
 */
export function send_ws_pcm_signal(pcm) {
	const duration = pcm.length / SAMPLE_RATE;
	swslog(`Sending ${pcm.length} samples (${duration}s) to devices...`);
	ws.send(pcm.buffer);
}

let on_message_external = null;
export function register_ws_onmessage(callback) {
	on_message_external = callback;
}

ws.onmessage = event => {
	const msg = JSON.parse(event.data);
	swslog(`Received message => ${JSON.stringify(msg)}`);

	if (on_message_external) {
		on_message_external(msg);
	}
};

ws.onopen = () => {
	swslog("Connected to server");
	send_ws_msg({ cmd: "getinfo" });
};

ws.onclose = async () => {
	swslog("Disconnected from server... Waiting 2 seconds before reconnecting...");
	await new Promise(r => setTimeout(r, 2000));
	// swslog("Reconnecting to server...");
	const nws = create_websocket();
	nws.onopen = ws.onopen;
	nws.onmessage = ws.onmessage;
	nws.onclose = ws.onclose;
	ws = nws;
}
