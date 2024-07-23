import { idbkv } from "../script.mjs";
import { load_and_send_pcm, load_pcm } from "./load_send_pcm.mjs";
import { NpWaveFormCanvas } from "./np-waveform-canvas.mjs";
import { PARTICIPANT_ID_GLO } from "./participantid_analytics.mjs";
import { notnull } from "./util.mjs";

const hapfilepicker_div = /** @type {HTMLDivElement} **/ (document.getElementById("hapfilepicker"));
const folderselect_div = /** @type {HTMLDivElement} **/ (hapfilepicker_div.querySelector("div .folderselect"));
const openfolder_button = /** @type {HTMLButtonElement} **/ (hapfilepicker_div.querySelector("button.openfolder"));
const openeddirectory_div = /** @type {HTMLDivElement} **/ (hapfilepicker_div.querySelector("div.openeddirectory"));
const changefolder_button = /** @type {HTMLButtonElement} **/ (openeddirectory_div.querySelector("button.changefolder"));
const opendirname_h2 = /** @type {HTMLHeadingElement} **/ (openeddirectory_div.querySelector("h2"));
const filelist_div = /** @type {HTMLDivElement} **/ (openeddirectory_div.querySelector(".filelist"));

/** @typedef {{ name: string, filename: string, sha265: string, origin: string, model: string, prompt: string, starred: boolean, trash: boolean, vote: number, playcount: number }} FileEntryMeta */

const SYMBOL_FILE_HANDLE = Symbol("file_handle");
const SYMBOL_FILE_NAME = Symbol("file_name");


let open_directory_promise_queue = Promise.resolve(); // multiple concurrent open_directory calls result in duplicate dom elements

/**
 * mutex queue for open_directory
 *
 * @param {FileSystemDirectoryHandle} dir_handle
 * @returns {Promise<void>}
 */
function open_directory(dir_handle) {
	// console.log("open_directory");
	return new Promise((resolve, reject) => {
		open_directory_promise_queue = open_directory_promise_queue
			.then(() => open_directory_internal(dir_handle).then(resolve, reject));
	});
}
/**
 *
 * @param {FileSystemDirectoryHandle} dir_handle
 */
async function open_directory_internal(dir_handle) {
	// console.debug("open_directory_internal");
	openeddirectory_div.style.display = "";
	folderselect_div.style.display = "none";
	opendirname_h2.textContent = dir_handle.name;

	const filelist_files = new Set([...filelist_div.querySelectorAll("div.file")]);

	/** @type {{ entry: FileSystemFileHandle, file_div: HTMLDivElement }[]} */
	const new_files = [];

	const entries_iter = dir_handle.values();
	const entries_sorted = [];
	for await (const entry of entries_iter) {
		entries_sorted.push(entry);
	}
	entries_sorted.sort((a, b) => a.name.localeCompare(b.name));

	for (const entry of entries_sorted) {
		if (entry.kind != "file" || !entry.name.endsWith(".wav")) {
			// console.debug("Skipping non-wav file", entry);
			continue;
		}

		const fdiv = await (async () => {
			for (const fdiv of filelist_files) {
				if (await entry.isSameEntry(fdiv[SYMBOL_FILE_HANDLE])) return fdiv;
			}
			return null;
		})();

		if (fdiv) {
			filelist_files.delete(fdiv);
			notnull(fdiv.querySelector("span.filename")).textContent = entry.name;
			continue;
		} else {
			/** @type {FileEntryMeta} */
			const fallback_file_entry = {
				name: entry.name,
				filename: entry.name,
				sha265: "",
				origin: dir_handle.name,
				model: "",
				prompt: "",
				starred: false,
				trash: false,
				vote: 0,
				playcount: 0,
			};

			const filemeta_ikvs = PARTICIPANT_ID_GLO.get_filemeta_store();
			/** @type {FileEntryMeta} */
			const filemeta_initial = await idbkv.get(entry.name, filemeta_ikvs) ?? (await idbkv.set(entry.name, fallback_file_entry, filemeta_ikvs), fallback_file_entry);


			const file_div = document.createElement("div");

			new_files.push({ entry, file_div });

			{ // init file_div
				file_div.className = "file";
				file_div.classList.toggle("starred", filemeta_initial.starred);
				file_div.classList.toggle("trashed", filemeta_initial.trash);
				file_div.classList.toggle("upvoted", filemeta_initial.vote == +1);
				file_div.classList.toggle("downvoted", filemeta_initial.vote == -1);

				file_div[SYMBOL_FILE_HANDLE] = entry;
				file_div[SYMBOL_FILE_NAME] = entry.name;

				const syncstatus_div = document.createElement("div");
				syncstatus_div.className = "syncstatus";
				file_div.appendChild(syncstatus_div);
				syncstatus_div.innerHTML = `<span class="material-symbols-outlined"></span>`

				const filename_span = document.createElement("span");
				filename_span.className = "filename";
				filename_span.textContent = entry.name;
				file_div.appendChild(filename_span);


				const waveformcontainer_div = document.createElement("div");
				waveformcontainer_div.className = "waveformcontainer";
				file_div.appendChild(waveformcontainer_div);
				const waveform_canvas = new NpWaveFormCanvas();
				// waveform_canvas.width = 50;
				// waveform_canvas.height = 20;
				waveformcontainer_div.appendChild(waveform_canvas);
				entry.getFile().then(async file => {
					const pcm = await load_pcm(file);
					waveform_canvas.draw_waveform(pcm);
				}).catch(e => console.log(e));


				const bdiv = document.createElement("div");
				bdiv.className = "buttons";
				file_div.appendChild(bdiv);

				const upload_button = document.createElement("button");
				upload_button.textContent = "Load";
				bdiv.appendChild(upload_button);

				// const star_button = document.createElement("button");
				// star_button.className = "star";
				// star_button.innerHTML = `<span class="material-symbols-outlined">star</span>`;
				// bdiv.appendChild(star_button);

				// star_button.addEventListener("click", async ev => {
				// 	filemeta.starred = !filemeta.starred;
				// 	file_div.classList.toggle("starred", filemeta.starred);
				// 	await sync_file_meta(file_div, filemeta);
				// });

				const upvote_button = document.createElement("button");
				upvote_button.className = "upvote";
				upvote_button.innerHTML = `<span class="material-symbols-outlined">thumb_up</span>`;
				bdiv.appendChild(upvote_button);
				const downvote_button = document.createElement("button");
				downvote_button.className = "downvote";
				downvote_button.innerHTML = `<span class="material-symbols-outlined">thumb_down</span>`;
				bdiv.appendChild(downvote_button);
				[upvote_button, downvote_button].forEach(b => b.addEventListener("click", async ev => {
					const new_vote = ev.currentTarget == upvote_button ? +1 : -1;
					const filemeta = await idbkv.get(entry.name, filemeta_ikvs);
					const old_vote = filemeta.vote;
					if (old_vote == new_vote) {
						filemeta.vote = 0;
						file_div.classList.remove("upvoted", "downvoted");
					} else {
						filemeta.vote = new_vote;
						file_div.classList.toggle("upvoted", new_vote == +1);
						file_div.classList.toggle("downvoted", new_vote == -1);
					}

					await sync_file_meta(entry.name, file_div, filemeta, filemeta_ikvs);
				}));



				[file_div, filename_span, upload_button].forEach(el => el.addEventListener("click", async ev => {
					if (ev.target != ev.currentTarget) return;
					try {
						const file = await entry.getFile();
						await load_and_send_pcm(file);
					} catch (e) {
						console.error(e);
						alert("Failed to load PCM from file: " + e);
					}
				}));
			}
			filelist_div.append(file_div);
		}
	}

	for (const file_div of filelist_files) {
		file_div.remove();
	}

	if (new_files.length) {
		await sync_by_filename(new_files);
	}

	// console.debug("open_directory_internal done");
}

/**
 * sync file meta and set sync status classes
 *
 * @param {string} filename
 * @param {HTMLDivElement} file_div
 * @param {FileEntryMeta} filemeta
 * @param {*} filemeta_ikvs
 */
async function sync_file_meta(filename, file_div, filemeta, filemeta_ikvs) {
	await idbkv.set(filename, filemeta, filemeta_ikvs);
	try {
		file_div.classList.remove("sync-failed");
		file_div.classList.add("syncing");
		const sync_enabled = await PARTICIPANT_ID_GLO.sync_file_meta(filemeta);
		if (sync_enabled) file_div.classList.add("synced");
		else file_div.classList.remove("synced");
	} catch (e) {
		console.error("Failed to sync file meta", e);
		file_div.classList.add("sync-failed");
	} finally {
		file_div.classList.remove("syncing");
	}
}
/**
 *
 * @param {string} filename
 * @returns
 */
export async function bump_playcount_on_filemeta(filename) {
	const filemeta_ikvs = PARTICIPANT_ID_GLO.get_filemeta_store();
	/** @type {import("./folderfilepicker.mjs").FileEntryMeta} */
	const filemeta = await idbkv.get(filename, filemeta_ikvs);
	if (!filemeta) throw new Error("Filemeta not found");
	filemeta.playcount = (filemeta.playcount ?? 0) + 1;

	const div = /** @type {HTMLDivElement} */ (notnull([...filelist_div.querySelectorAll("div.file")].find(div => div[SYMBOL_FILE_NAME] == filename)));
	await sync_file_meta(filename, div, filemeta, filemeta_ikvs);
}


for (const button of [openfolder_button, changefolder_button]) {
	button.addEventListener("click", async () => {
		try {
			if (!("showDirectoryPicker" in window)) {
				alert("Directory picker not supported in this browser");
				return;
			}
			const dir_handle = await window.showDirectoryPicker({ mode: "readwrite" });
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

async function load_last_used_directory() { // load last used directory
	const last_used_dir_handle = /** @type {FileSystemDirectoryHandle | null} **/ (await idbkv.get("last_used_dir_handle"));
	if (last_used_dir_handle) {
		console.log("Opening last used directory", last_used_dir_handle);
		try {
			if (await last_used_dir_handle.queryPermission() == "prompt") {
				await last_used_dir_handle.requestPermission({ mode: "readwrite" });
			}
			await open_directory(last_used_dir_handle);
		} catch(e) {
			console.error(e);
			console.error("Unable to open last_used_dir_handle");
			alert(`Unable to open last used directory '${last_used_dir_handle.name}'. Please reselect the directory.`)
		}
	}
}
load_last_used_directory().catch(e => console.error("Error loading last used directory", e)); //no top level await for this

{ // rescan last used directory when tab is focused
	document.addEventListener("visibilitychange", async () => {
		if (!document.hidden || document.visibilityState === "visible") {
			const last_used_dir_handle = /** @type {FileSystemDirectoryHandle | null} **/ (await idbkv.get("last_used_dir_handle"));
			if (!last_used_dir_handle) return;
			console.debug("rescanning last used directory", last_used_dir_handle);
			await open_directory(last_used_dir_handle);
		}
	});
	window.addEventListener("focus", async () => {
		const last_used_dir_handle = /** @type {FileSystemDirectoryHandle | null} **/ (await idbkv.get("last_used_dir_handle"));
		if (!last_used_dir_handle) return;
		console.debug("focus rescanning last used directory", last_used_dir_handle);
		await open_directory(last_used_dir_handle);
	});

}
export async function clean_open_and_sync_library() {
	const last_used_dir_handle = /** @type {FileSystemDirectoryHandle | null} **/ (await idbkv.get("last_used_dir_handle"));
	if (!last_used_dir_handle) return;
	filelist_div.querySelectorAll("div.file").forEach(file_div => file_div.remove());
	await open_directory(last_used_dir_handle);
}
export async function close_opened_directory() {
	await idbkv.del("last_used_dir_handle");

	openeddirectory_div.style.display = "none";
	folderselect_div.style.display = "";

	filelist_div.querySelectorAll("div.file").forEach(file_div => file_div.remove());
}



/**
 *
 * @param {FileSystemFileHandle} entry
 */
async function get_file_sha256(entry) {
	const hash = await window.crypto.subtle.digest("SHA-256", await (await entry.getFile()).arrayBuffer());
	return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 *
 * @param {FileSystemFileHandle[]} new_files
 */
async function sync_by_sha265(new_files) {
	const file_hash_map = new Map(await Promise.all(new_files.map(async entry => { return /** @type {[string, FileSystemFileHandle]} */ ([await get_file_sha256(entry), entry]); })));

	const f = await fetch("/api/check_sync_hashes", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify([...file_hash_map.keys()]),
	});

	throw new Error("Not implemented");
}

/**
 *
 * @param {{ entry: FileSystemFileHandle, file_div: HTMLDivElement }[]} new_files
 */
async function sync_by_filename(new_files) {
	const already_synced = await PARTICIPANT_ID_GLO.get_synced_files();
	if (already_synced === false) return;

	// set file_div.classlist.add("synced") for already_synced files
	const new_files_to_sync = new_files.filter(({ entry, file_div }) => {
		const synced = already_synced.includes(entry.name);
		file_div.classList.remove("sync-failed");
		file_div.classList.toggle("synced", synced);
		return !synced;
	});

	const filemeta_ikvs = PARTICIPANT_ID_GLO.get_filemeta_store();

	for (const {entry, file_div} of new_files_to_sync) {
		try {
			file_div.classList.remove("sync-failed");
			file_div.classList.add("syncing");
			const filemeta = await idbkv.get(entry.name, filemeta_ikvs);
			if (!filemeta) throw new Error("Filemeta not found");
			const sync_enabled = await PARTICIPANT_ID_GLO.sync_file(entry, filemeta);
			if (sync_enabled) file_div.classList.add("synced");
			else file_div.classList.remove("synced");
		} catch (e) {
			file_div.classList.add("sync-failed");
			console.error("Failed to sync file", entry, e);
		} finally {
			file_div.classList.remove("syncing");
		}
	}
}

/**
 *
 * @param {Blob} blob
 * @param {FileEntryMeta} filemeta
 */
export async function save_signal_blob_to_file(blob, filemeta) {
	const last_used_dir_handle = /** @type {FileSystemDirectoryHandle | null} **/ (await idbkv.get("last_used_dir_handle"));
	if (!last_used_dir_handle) {
		alert("Please open a directory to save the signal");
		throw new Error("No last used directory");
	}

	const ps = await last_used_dir_handle.requestPermission({ mode: "readwrite" }); // this does not actually check/ask for readwrite permission for some reason? (if only read is granted)
	if (ps != "granted") {
		alert("Permission denied to write file to directory");
		throw new Error("Permission denied to write file to directory");
	}
	const fh = await last_used_dir_handle.getFileHandle(filemeta.filename, { create: true });
	const writable = await fh.createWritable();
	await writable.write(blob);
	await writable.close();


	const filemeta_ikvs = PARTICIPANT_ID_GLO.get_filemeta_store();
	await idbkv.set(filemeta.filename, filemeta, filemeta_ikvs);

	await open_directory(last_used_dir_handle); //will also sync the file
}