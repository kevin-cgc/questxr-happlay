import { notnull } from "./util.mjs";
import { idbkv } from "../script.mjs";
import { clean_open_and_sync_library, close_opened_directory } from "./folderfilepicker.mjs";

const participantinfo_div = /** @type {HTMLDivElement} */ (notnull(document.querySelector(".participantinfo")));
const participantid_input = /** @type {HTMLInputElement} */ (notnull(participantinfo_div.querySelector("input[type=text]")));

const APC = {
	async alert(x) {
		return alert(x);
	},
	async prompt(x) {
		return prompt(x);
	},
	async confirm(x) {
		return confirm(x);
	}
};


class ParticipantID {
	/**
	 * @type {{ participant_id: string, participant_id_digest: string } | null}
	 */
	#participant_id_info = null;

	#filemeta_idbkv;

	/**
	 * @param {*} filemeta_idbkv
	 * @param {{ participant_id: string, participant_id_digest: string } | null} last_participant_id_info
	 */
	constructor(filemeta_idbkv, last_participant_id_info) {
		this.#filemeta_idbkv = filemeta_idbkv;

		this.#participant_id_info = last_participant_id_info;
		participantid_input.value = last_participant_id_info?.participant_id ?? "";

		participantid_input.addEventListener("input", ev => {
			if (this.#participant_id_info && participantid_input.value == this.#participant_id_info.participant_id) return participantinfo_div.classList.add("committed");
			else if (!this.#participant_id_info  && participantid_input.value == "") return participantinfo_div.classList.add("disabled");

			participantinfo_div.classList.remove("committed");
			participantinfo_div.classList.remove("disabled");
		});

		participantid_input.addEventListener("change", async ev => {
			const participant_id = participantid_input.value;
			if (participant_id.length === 0) {
				await this.#set(null);
				return;
			}

			const u = new URL("/api/participant", location.origin);
			u.searchParams.set("participant_id", participant_id);
			const resp = await fetch(u);

			let data;
			if (resp.status === 404) {
				const res = await APC.confirm(`Confirm: Create new participant '${participant_id}'?`);
				if (!res) {
					this.#set(null);
					return;
				}

				const resp = await fetch(u, { method: "POST" });
				if (!resp.ok) {
					APC.alert(`Failed to create participant '${participant_id}'`);
					this.#set(null);
					return;
				}
				data = await resp.json();
			} else {
				data = await resp.json();
				if (!data.participant_id_digest) {
					APC.alert("Invalid response from server");
					this.#set(null);
					return;
				}
				let res = await APC.confirm(`Confirm: Overwrite/append to existing server side save data for participant '${data.participant_id}' (created at ${new Date(data.created_at).toLocaleString()})?`);
				if (!res) {
					this.#set(null);
					return;
				}
			}
			await this.#set({ participant_id, participant_id_digest: data.participant_id_digest });
		});


		this.#set(last_participant_id_info).catch(e => console.error(e));
	}

	get_filemeta_store() {
		return this.#filemeta_idbkv;
	}

	/**
	 *
	 * @param {{ participant_id: string, participant_id_digest: string } | null} participant_id_info
	 * @returns
	 */
	async #set(participant_id_info) {
		const old_participant_id_info = this.#participant_id_info;
		participantid_input.value = participant_id_info?.participant_id ?? "";
		this.#participant_id_info = participant_id_info;
		const participant_id_digest = participant_id_info?.participant_id_digest ?? null;
		await idbkv.set("last_participant_id_info", participant_id_info);
		this.#filemeta_idbkv = participant_id_digest == null ?
			DEFAULT_FILE_META_STORE :
			await idbkv.createStore("file_metadata_"+participant_id_digest, "keyval");

		console.log("old_participant_id_info == participant_id_info =>", old_participant_id_info == participant_id_info)
		if (old_participant_id_info == participant_id_info) await clean_open_and_sync_library(); //happens during init
		else {
			await close_opened_directory();
			console.log("closing open directory");
		}

		participantinfo_div.classList.toggle("committed", !!participant_id_digest);
		participantinfo_div.classList.toggle("disabled", !participant_id_digest);
	}


	/**
	 *
	 * @param {FileSystemFileHandle} entry
	 * @param {import("./folderfilepicker.mjs").FileEntryMeta} meta
	 * @returns {Promise<boolean>} false if sync not available
	 */
	async sync_file(entry, meta) {
		if (!this.#participant_id_info) return false;


		const u = new URL("/api/participant/file", location.origin);
		u.searchParams.set("participant_id_digest", this.#participant_id_info.participant_id_digest);

		for (const key of Object.keys(meta)) {
			u.searchParams.set(key, meta[key]);
		}

		const f = await fetch(u, {
			method: "PUT",
			body: await entry.getFile()
		});

		if (f.ok) {
			return true;
		} else {
			console.error("Failed to sync file", f);
			throw new Error("Failed to sync file");
		}
	}

	/**
	 * @param {import("./folderfilepicker.mjs").FileEntryMeta} meta
	 * @returns {Promise<boolean>} false if sync not available
	 */
	async sync_file_meta(meta) {
		if (!this.#participant_id_info) return false;

		const u = new URL("/api/participant/file/meta", location.origin);
		u.searchParams.set("participant_id_digest", this.#participant_id_info.participant_id_digest);

		for (const key of Object.keys(meta)) {
			u.searchParams.set(key, meta[key]);
		}

		const f = await fetch(u, { method: "PUT" });

		if (f.ok) {
			return true;
		} else {
			console.error("Failed to sync file meta", f);
			throw new Error("Failed to sync file meta");
		}
	}



	/**
	 * @returns {Promise<string[] | false>}
	 */
	async get_synced_files() {
		if (!this.#participant_id_info) return false;

		const u = new URL("/api/participant/files", location.origin);
		u.searchParams.set("participant_id_digest", this.#participant_id_info.participant_id_digest);

		const f = await fetch(u);
		if (!f.ok) {
			console.error("Failed to get files", f);
			return false;
		}

		return await f.json();
	}

}
const last_participant_id_info = await idbkv.get("last_participant_id_info");
const DEFAULT_FILE_META_STORE = await idbkv.createStore("file_metadata_default", "keyval");
export const PARTICIPANT_ID_GLO = new ParticipantID(DEFAULT_FILE_META_STORE, last_participant_id_info);





// /** @typedef {{ type: string, data: any }} AnalyticsEvent */
// class AnalyticsLog {
// 	/** @type {AnalyticsEvent[]} */
// 	#events;

// 	/** @type {string} */
// 	#log_name

// 	/**
// 	 *
// 	 * @param {string} log_name
// 	 */
// 	constructor(log_name = "happlay_default_analytics_log") {
// 		this.#log_name = log_name;
// 		this.#events = await idbkv.get(this.#log_name) || [];
// 	}

// 	/**
// 	 *
// 	 * @param {AnalyticsEvent} event
// 	 */
// 	async log(event) {
// 		this.#events.push(event);

// 		this.#save();

// 		this.#debounce_sync();
// 	}

// 	#save() {
// 		idbkv.set(this.#log_name, this.#events);
// 	}

// 	/** @type {NodeJS.Timeout | number | null} */
// 	#sync_timeout = null;
// 	#debounce_sync() {
// 		if (this.#sync_timeout) clearTimeout(this.#sync_timeout);
// 		this.#sync_timeout = setTimeout(() => {
// 			this.#sync_timeout = null;
// 			this.#sync();
// 		}, 3000);
// 	}

// 	async #sync() {


// 	}
// }