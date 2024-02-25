
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

const dragndroptacton_div = document.getElementById("dragndroptacton");
document.body.addEventListener("dragenter", event => {
	event.preventDefault();
	// flash the dragndroptacton_div
	// dragndroptacton_div.animate([{ borderColor: "#eee" }, { borderColor: "#666" }], {
	// 	duration: 120,
	// 	iterations: 3,
	// 	direction: "alternate",
	// });
});
document.addEventListener("drop", event => event.preventDefault());

dragndroptacton_div.addEventListener("dragover", event => {
	event.preventDefault();
	dragndroptacton_div.classList.add("dragover");
});
dragndroptacton_div.addEventListener("dragleave", event => {
	event.preventDefault();
	dragndroptacton_div.classList.remove("dragover");
});
dragndroptacton_div.addEventListener("drop", event => {
	event.preventDefault();
	dragndroptacton_div.classList.remove("dragover");
	const files = event.dataTransfer.files;
	if (files.length > 0) {
		const file = files[0];
		// if (file.type !== "audio/wav") { // lets just let decodeAudioData complain
		// 	alert("Invalid file type, must be audio/wav");
		// 	return;
		// }
		if (file.size > 5e6) {
			alert("File size should be less than 5MB (soft limit, can remove if needed)");
			return;
		}

		const reader = new FileReader();
		reader.onload = async () => {
			try {
				const data = reader.result;
				if (typeof data === "string") throw new TypeError("unreachable");

				const audio_ctx = new AudioContext({ sampleRate: 8000, latencyHint: "playback" });
				const decoded_pcm = await audio_ctx.decodeAudioData(data);
				console.log(decoded_pcm);

				if (decoded_pcm.numberOfChannels !== 1) {
					alert("Audio file is not mono");
					return;
				}

				const pcm = decoded_pcm.getChannelData(0); // device expects f32le
				ws.send(pcm.buffer);

				// send_msg({ cmd: "upload", data });
			} catch (err) {
				console.error(err);
				alert("Error reading file, see console for details");
			}
		};
		reader.readAsArrayBuffer(file);
	} else {
		alert("No files dropped");
	}
});