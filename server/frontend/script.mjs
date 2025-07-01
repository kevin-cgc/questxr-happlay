export * as idbkv from "./thirdparty/idb-keyval.js";

import { swslog, register_ws_onmessage } from "./js/websocket.mjs";
import { add_or_update_device, mark_device_acked } from "./js/devicelist.mjs";
import { send_pcm } from "./js/load_send_pcm.mjs";
import { last_waveform, mark_playback_loaded, start_playback, stop_playback } from "./js/playback_waveform.mjs";
import { } from "./js/dragndrop.mjs";
import { } from "./js/folderfilepicker.mjs";
import { } from "./js/prompting.mjs";
import { } from "./js/captionrating.mjs";
import { } from "./js/videorating.mjs";


register_ws_onmessage(msg => {
	if (msg.cmd == "starting_playback") {
		start_playback();
	} else if (msg.cmd == "stopping_playback") {
		stop_playback();
	} else if (msg.cmd == "ack_haptic_signal") {
		mark_device_acked(msg.data.system_id);
		mark_playback_loaded();
	} else if ("systemId" in msg) {
		add_or_update_device(msg);

		if (last_waveform) {
			swslog("Resending last waveform due to new device");
			send_pcm(last_waveform.pcm, last_waveform.filename);
		}
	} else {
		swslog(`[WARN] Unknown message cmd => ${msg.cmd}`);
		console.error("Unknown message", msg);
	}
});



