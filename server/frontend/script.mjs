const SAMPLE_RATE = 8000;

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

	if (data.cmd == "starting_playback") {
		start_playback();
	} else if (data.cmd == "stopping_playback") {
		stop_playback();
	}
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

const dragndroptacton_form = document.getElementById("dragndroptacton");
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

dragndroptacton_form.addEventListener("dragover", event => {
	event.preventDefault();
	dragndroptacton_form.classList.add("dragover");
});
dragndroptacton_form.addEventListener("dragleave", event => {
	event.preventDefault();
	dragndroptacton_form.classList.remove("dragover");
});
dragndroptacton_form.addEventListener("drop", event => {
	event.preventDefault();
	dragndroptacton_form.classList.remove("dragover");
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

				const audio_ctx = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: "playback" });
				const decoded_pcm = await audio_ctx.decodeAudioData(data);
				console.log(decoded_pcm);

				if (decoded_pcm.numberOfChannels !== 1) {
					alert("Audio file is not mono");
					return;
				}

				const pcm = decoded_pcm.getChannelData(0); // device expects f32le

				draw_waveform(pcm);

				swslog(`Sending ${pcm.length} samples (${decoded_pcm.duration}s) to devices...`);
				ws.send(pcm.buffer);
			} catch (err) {
				console.error(err);
				alert("Error reading file, see browser console for details");
			}
		};
		reader.readAsArrayBuffer(file);
	} else {
		alert("No files dropped");
	}
});



const waveformcanvas = /** @type {HTMLCanvasElement} **/ (document.getElementById("waveformcanvas"));
const wf_ctx = waveformcanvas.getContext("2d");
wf_ctx.fillStyle = "black";
wf_ctx.fillRect(0, 0, waveformcanvas.width, waveformcanvas.height);
// put question mark
wf_ctx.font = "50px monospace";
wf_ctx.fillStyle = "white";
wf_ctx.textAlign = "center";
wf_ctx.fillText("Unknown current waveform", waveformcanvas.width / 2, waveformcanvas.height / 2);

let last_step = 0;

const draw_waveform = pcm => {
	wf_ctx.fillStyle = "black";
	wf_ctx.fillRect(0, 0, waveformcanvas.width, waveformcanvas.height);

	const { width, height } = waveformcanvas;
	last_step = pcm.length / width;
	wf_ctx.strokeStyle = "white";
	wf_ctx.beginPath();
	wf_ctx.moveTo(0, height / 2);
	for (let i = 0; i < width; i++) {
		const sample = pcm[Math.floor(i * last_step)];
		wf_ctx.lineTo(i, height / 2 - sample * height / 2);
	}
	wf_ctx.stroke();
}


let playback_started_at = null;
function start_playback() {
	playback_started_at = performance.now();

	const tick = () => {
		if (playback_started_at == null) {
			draw_playback_head(0);
			return;
		} else {
			const elapsed = performance.now() - playback_started_at;
			draw_playback_head(elapsed);
			requestAnimationFrame(tick);
		}
	};

	tick();
}
function stop_playback() {
	playback_started_at = null;
}

const playbackheadcanvas = /** @type {HTMLCanvasElement} **/ (document.getElementById("playbackheadcanvas"));
const pbh_ctx = playbackheadcanvas.getContext("2d");
const draw_playback_head = elapsed => {
	const { width, height } = playbackheadcanvas;
	pbh_ctx.clearRect(0, 0, width, height);
	pbh_ctx.fillStyle = "red";
	const position = (elapsed / 1000) * SAMPLE_RATE / last_step;
	pbh_ctx.fillRect(position, 0, 2, height);
}

