import { load_and_send_pcm } from "./load_send_pcm.mjs";
import { notnull } from "./util.mjs";

export const dragndroptacton_form = notnull(document.getElementById("dragndroptacton"));
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
	const files = event.dataTransfer?.files;
	if (files && files.length > 0) {
		const file = files[0];
		load_and_send_pcm(file);
	} else {
		alert("No files dropped");
	}
});