
const serverwslog = document.getElementById("serverwslog");
function log_to_logcontainer(message, logcontainer) {
	const msglog = logcontainer.querySelector(".msglog");
	const div = document.createElement("div");
	div.className = "logmsg";
	div.textContent = message;
	msglog.appendChild(div);
	div.scrollIntoView();
}
const swslog = msg => log_to_logcontainer(msg, serverwslog);

const url = new URL(location.href);
let ws = new WebSocket(`ws://${url.host}/ws`);

const send_msg = msg => {
	swslog(`Sending message => ${JSON.stringify(msg)}`);
	ws.send(JSON.stringify(msg));
};

ws.onmessage = event => {
	const data = JSON.parse(event.data);
	swslog(`Received message => ${JSON.stringify(data)}`);
};

ws.onopen = () => {
	swslog("Connected to server");
	send_msg({ cmd: "getinfo" });
};

ws.onclose = async () => {
	swslog("Disconnected from server");
	// Reconnect
	swslog("Waiting 2 seconds before reconnecting...");
	await new Promise(r => setTimeout(r, 2000));
	swslog("Reconnecting to server...");
	const nws = new WebSocket(`ws://${url.host}/ws`);
	nws.onopen = ws.onopen;
	nws.onmessage = ws.onmessage;
	nws.onclose = ws.onclose;
	ws = nws;
}