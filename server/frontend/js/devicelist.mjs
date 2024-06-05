import { notnull } from "./util.mjs";
import { send_ws_msg } from "./websocket.mjs";

const qdevices = notnull(document.getElementById("qdevices"));
const devicelist = notnull(qdevices.querySelector(".devicelist"));
const refresh_button = notnull(qdevices.querySelector("button.refresh"));
refresh_button.addEventListener("click", () => {
	devicelist.innerHTML = "";
	send_ws_msg({ cmd: "getinfo" })
});

export function mark_devices_notacked() {
	const device_divs = devicelist.querySelectorAll(".device");
	for (const device_div of device_divs) device_div.classList.add("notacked");
}
export function mark_device_acked(system_id) {
	const device_div = devicelist.querySelector(`[data-system-id="${system_id}"]`);
	if (device_div) device_div.classList.remove("notacked");
}

export function get_num_devices() {
	return devicelist.querySelectorAll(".device").length;
}

export function add_or_update_device(device_info_msg) {
	const dim = device_info_msg;

	const olddiv = devicelist.querySelector(`[data-system-id="${dim.systemId}"]`);
	if (olddiv) olddiv.remove();

	const div = notnull(new DOMParser().parseFromString(`
	<div class="device" data-system-id="${dim.systemId}">
		<h2>${dim.systemName} <small class="id">${dim.systemId}</small></h2>
		<h3>Haptic Sample Rate <!--<br><small>(quest controllers must be connected when getting info)</small>--></h3>
		<div>
			Left: ${dim.haptic_sample_rate?.left}Hz ${dim.haptic_sample_rate?.left == 0 ? "(disconnected?)":""}
			<br>
			Right: ${dim.haptic_sample_rate?.right}Hz ${dim.haptic_sample_rate?.right == 0 ? "(disconnected?)":""}
		</div>
	</div>
	`, "text/html").body.firstChild);

	devicelist.appendChild(div);
}