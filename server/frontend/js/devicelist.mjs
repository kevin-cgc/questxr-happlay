import { notnull } from "./util.mjs";
import { send_ws_msg } from "./websocket.mjs";

const qdevices = notnull(document.getElementById("qdevices"));
const devicelist = notnull(qdevices.querySelector(".devicelist"));
const refresh_button = notnull(qdevices.querySelector("button.refresh"));
const trigger_latched_playback_checkbox = /** @type {HTMLInputElement} */ (notnull(qdevices.querySelector("input.trigger-latched-playback")));
refresh_button.addEventListener("click", () => {
	devicelist.innerHTML = "";
	send_ws_msg({ cmd: "getinfo" });
	window.dispatchEvent(new Event("refresh-haptic-devices"));
});
trigger_latched_playback_checkbox.addEventListener("change", () => {
	send_ws_msg({ cmd: "set_trigger_latched_playback", data: { enabled: trigger_latched_playback_checkbox.checked } });
});

export function update_trigger_latched_playback(enabled) {
	trigger_latched_playback_checkbox.checked = enabled;
}

export function mark_devices_notacked() {
	const device_divs = devicelist.querySelectorAll(".device.quest-device");
	for (const device_div of device_divs) device_div.classList.add("notacked");
}
export function mark_device_acked(system_id) {
	const device_div = devicelist.querySelector(`[data-system-id="${system_id}"]`);
	if (device_div) device_div.classList.remove("notacked");
}

export function get_num_devices() {
	return devicelist.querySelectorAll(".device.quest-device").length;
}
export function update_bhaptics_vest(connected, actuator_num) {
	devicelist.querySelector(".device.bhaptics-device")?.remove();
	if (!connected) return;

	const div = document.createElement("div");
	div.className = "device bhaptics-device";
	div.innerHTML = `
		<h2>bHaptics TactSuit <small class="id">Vest</small></h2>
		<h3>bHaptics Player</h3>
		<div>Connected</div>
		<label class="bhaptics-actuator">Actuator
			<input type="number" min="0" max="39" step="1" value="${actuator_num}">
		</label>
	`;
	const actuator_input = /** @type {HTMLInputElement} */ (notnull(div.querySelector("input")));
	actuator_input.addEventListener("change", () => {
		const value = Number.parseInt(actuator_input.value, 10);
		if (!Number.isInteger(value) || value < 0 || value > 39) {
			actuator_input.value = String(actuator_num);
			return;
		}
		actuator_num = value;
		window.dispatchEvent(new CustomEvent("bhaptics-actuator-change", { detail: value }));
	});
	devicelist.appendChild(div);
}

export function add_or_update_device(device_info_msg) {
	const dim = device_info_msg;
	update_trigger_latched_playback(dim.trigger_latched_playback ?? false);

	const olddiv = devicelist.querySelector(`[data-system-id="${dim.systemId}"]`);
	if (olddiv) olddiv.remove();

	const div = notnull(new DOMParser().parseFromString(`
	<div class="device quest-device" data-system-id="${dim.systemId}">
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