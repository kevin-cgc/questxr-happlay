import * as idbkv from "./thirdparty/idb-keyval.js";

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
	} else if ("systemId" in data) {
		const olddiv = devicelist.querySelector(`[data-system-id="${data.systemId}"]`);
		if (olddiv) olddiv.remove();

		const div = new DOMParser().parseFromString(`
		<div class="device" data-system-id="${data.systemId}">
			<h2>${data.systemName} <small class="id">${data.systemId}</small></h2>
			<h3>Haptic Sample Rate <!--<br><small>(quest controllers must be connected when getting info)</small>--></h3>
			<div>
				Left: ${data.haptic_sample_rate?.left}Hz ${data.haptic_sample_rate?.left == 0 ? "(disconnected?)":""}
				<br>
				Right: ${data.haptic_sample_rate?.right}Hz ${data.haptic_sample_rate?.right == 0 ? "(disconnected?)":""}
			</div>
		</div>
		`, "text/html").body.firstChild;

		devicelist.appendChild(div);
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

const qdevices = document.getElementById("qdevices");
const devicelist = qdevices.querySelector(".devicelist");
const refresh_button = qdevices.querySelector("button.refresh");
refresh_button.addEventListener("click", () => {
	devicelist.innerHTML = "";
	send_msg({ cmd: "getinfo" })
});

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
dragndroptacton_form.addEventListener("click", async () => {
	try {
		if (!("showOpenFilePicker" in window)) {
			alert("File picker not supported in this browser");
			return;
		}
		const [file_handle] = await window.showOpenFilePicker({
			types: [{
				description: "Haptic PCM (8KHz+F32LE ideally)",
				accept: {
					"audio/wav": [".wav", ".WAV", ".wave", ".WAVE"],
					"audio/aac": [".aac", ".AAC"],
					"audio/ogg": [".ogg", ".OGG"],
					"audio/opus": [".opus", ".OPUS"],
					"audio/webm": [".webm", ".WEBM", ".weba", ".WEBA"],
					"audio/flac": [".flac", ".FLAC"],
					"audio/x-flac": [".flac", ".FLAC"],
				},
			},],
			multiple: false,
			excludeAcceptAllOption: false,
		});
		const file = await file_handle.getFile();
		load_and_send_pcm(file);
	} catch (e) {
		if (e.name == "AbortError") {
			//do nothing
		} else {
			throw e;
		}
	}
});
dragndroptacton_form.addEventListener("drop", event => {
	event.preventDefault();
	dragndroptacton_form.classList.remove("dragover");
	const files = event.dataTransfer.files;
	if (files.length > 0) {
		const file = files[0];
		load_and_send_pcm(file);
	} else {
		alert("No files dropped");
	}
});

/**
 *
 * @param {File} file
 */
function load_and_send_pcm(file) {
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
}



const waveformcanvas = /** @type {HTMLCanvasElement} **/ (document.getElementById("waveformcanvas"));
const playbackheadcanvas = /** @type {HTMLCanvasElement} **/ (document.getElementById("playbackheadcanvas"));
playbackheadcanvas.width = waveformcanvas.width = waveformcanvas.parentElement.clientWidth;
window.addEventListener("resize", () => {
	playbackheadcanvas.width = waveformcanvas.width = waveformcanvas.parentElement.clientWidth;
	if (last_waveform) draw_waveform(last_waveform);
	else draw_unknown_waveform();
});

const wf_ctx = waveformcanvas.getContext("2d");
function draw_unknown_waveform() {
	wf_ctx.fillStyle = "black";
	wf_ctx.fillRect(0, 0, waveformcanvas.width, waveformcanvas.height);
	wf_ctx.font = "50px monospace";
	wf_ctx.fillStyle = "white";
	wf_ctx.textAlign = "center";
	wf_ctx.fillText("Unknown current waveform", waveformcanvas.width / 2, waveformcanvas.height / 2);
}
draw_unknown_waveform();

let last_step = 0;
let last_waveform = null;
const draw_waveform = pcm => {
	last_waveform = pcm;
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

const pbh_ctx = playbackheadcanvas.getContext("2d");
const draw_playback_head = elapsed => {
	const { width, height } = playbackheadcanvas;
	pbh_ctx.clearRect(0, 0, width, height);
	pbh_ctx.fillStyle = "red";
	const position = (elapsed / 1000) * SAMPLE_RATE / last_step;
	pbh_ctx.fillRect(position, 0, 2, height);
}


const hapfilepicker_div = /** @type {HTMLDivElement} **/ (document.getElementById("hapfilepicker"));
const folderselect_div = /** @type {HTMLDivElement} **/ (hapfilepicker_div.querySelector("div .folderselect"));
const openfolder_button = /** @type {HTMLButtonElement} **/ (hapfilepicker_div.querySelector("button.openfolder"));
const openeddirectory_div = /** @type {HTMLDivElement} **/ (hapfilepicker_div.querySelector("div.openeddirectory"));
const changefolder_button = /** @type {HTMLButtonElement} **/ (openeddirectory_div.querySelector("button.changefolder"));
const opendirname_h2 = /** @type {HTMLHeadingElement} **/ (openeddirectory_div.querySelector("h2"));
const filelist_div = /** @type {HTMLDivElement} **/ (openeddirectory_div.querySelector(".filelist"));

for (const button of [openfolder_button, changefolder_button]) {
	button.addEventListener("click", async () => {
		try {
			if (!("showDirectoryPicker" in window)) {
				alert("Directory picker not supported in this browser");
				return;
			}
			const dir_handle = await window.showDirectoryPicker();
			idbkv.set("last_used_dir_handle", dir_handle);
			await open_directory(dir_handle);
		} catch (e) {
			if (e.name == "AbortError") {
				//do nothing
			} else {
				throw e;
			}
		}
	});
}

{ // load last used directory
	const last_used_dir_handle = /** @type {FileSystemDirectoryHandle | null} **/ (await idbkv.get("last_used_dir_handle"));
	if (last_used_dir_handle) {
		console.log("Opening last used directory", last_used_dir_handle);
		await open_directory(last_used_dir_handle);
	}
}
{ // rescan last used directory when tab is focused
	document.addEventListener("visibilitychange", async () => {
		if (!document.hidden || document.visibilityState === "visible") {
			const last_used_dir_handle = /** @type {FileSystemDirectoryHandle | null} **/ (await idbkv.get("last_used_dir_handle"));
			if (last_used_dir_handle) {
				console.debug("rescanning last used directory", last_used_dir_handle);
				await open_directory(last_used_dir_handle);
			}
		}
	});
	window.addEventListener("focus", async () => {
		const last_used_dir_handle = /** @type {FileSystemDirectoryHandle | null} **/ (await idbkv.get("last_used_dir_handle"));
		if (last_used_dir_handle) {
			console.debug("focus rescanning last used directory", last_used_dir_handle);
			await open_directory(last_used_dir_handle);
		}
	});

}

async function open_directory(dir_handle) {
	openeddirectory_div.style.display = "";
	folderselect_div.style.display = "none";
	opendirname_h2.textContent = dir_handle.name;
	filelist_div.innerHTML = "";
	for await (const entry of dir_handle.values()) {
		if (entry.kind == "file") {
			const file_div = new DOMParser().parseFromString(`
				<div class="file">
					<span>${entry.name}</span>
					<button>Upload</button>
				</div>
			`, "text/html").body.querySelector("div");
			file_div.addEventListener("click", async () => {
				const file = await entry.getFile();
				load_and_send_pcm(file);
			});
			filelist_div.appendChild(file_div);
		} else {
			// console.log("Ignoring non-file entry", entry);
		}
	}
}