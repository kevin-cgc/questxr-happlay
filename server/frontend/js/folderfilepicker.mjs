import { idbkv } from "../script.mjs";
import { load_and_send_pcm } from "./load_send_pcm.mjs";
import { notnull } from "./util.mjs";

const hapfilepicker_div = /** @type {HTMLDivElement} **/ (document.getElementById("hapfilepicker"));
const folderselect_div = /** @type {HTMLDivElement} **/ (hapfilepicker_div.querySelector("div .folderselect"));
const openfolder_button = /** @type {HTMLButtonElement} **/ (hapfilepicker_div.querySelector("button.openfolder"));
const openeddirectory_div = /** @type {HTMLDivElement} **/ (hapfilepicker_div.querySelector("div.openeddirectory"));
const changefolder_button = /** @type {HTMLButtonElement} **/ (openeddirectory_div.querySelector("button.changefolder"));
const opendirname_h2 = /** @type {HTMLHeadingElement} **/ (openeddirectory_div.querySelector("h2"));
const filelist_div = /** @type {HTMLDivElement} **/ (openeddirectory_div.querySelector(".filelist"));

/** @typedef {{ name: string, filename: string, sha265: string, origin: string, model: string, prompt: string, starred: boolean, trash: boolean }} FileEntry */
const filemeta_ikvs = await idbkv.createStore("file_meta");

const SYMBOL_FILE_HANDLE = Symbol("file_handle");
/**
 *
 * @param {FileSystemDirectoryHandle} dir_handle
 */
async function open_directory(dir_handle) {
	if (dir_handle)
	openeddirectory_div.style.display = "";
	folderselect_div.style.display = "none";
	opendirname_h2.textContent = dir_handle.name;

	const filelist_files = new Set([...filelist_div.querySelectorAll("div.file")]);


	for await (const entry of dir_handle.values()) {
		if (entry.kind == "file" && entry.name.endsWith(".wav")) {
			const fdiv = await (async () => {
				for (const fdiv of filelist_files) {
					if (await entry.isSameEntry(fdiv[SYMBOL_FILE_HANDLE])) return fdiv;
				}
				return null;
			})();

			if (fdiv) {
				filelist_files.delete(fdiv);
				notnull(fdiv.querySelector("span")).textContent = entry.name;
				continue;
			} else {
				/** @type {FileEntry} */
				const fallback_file_entry = {
					name: entry.name,
					filename: entry.name,
					sha265: "",
					origin: dir_handle.name,
					model: "",
					prompt: "",
					starred: false,
					trash: false,
				};
				/** @type {FileEntry} */
				const filemeta = await idbkv.get(entry.name, filemeta_ikvs) ?? (await idbkv.set(entry.name, fallback_file_entry, filemeta_ikvs), fallback_file_entry);

				const file_div = document.createElement("div");
				{ // init file_div
					file_div.className = "file";
					file_div.classList.toggle("starred", filemeta.starred);
					file_div[SYMBOL_FILE_HANDLE] = entry;

					const span = document.createElement("span");
					span.className = "filename";
					span.textContent = entry.name;
					file_div.appendChild(span);

					const bdiv = document.createElement("div");
					bdiv.className = "buttons";
					file_div.appendChild(bdiv);

					const upload_button = document.createElement("button");
					upload_button.textContent = "Upload";
					bdiv.appendChild(upload_button);

					const star_button = document.createElement("button");
					star_button.className = "star";
					star_button.innerHTML = `<span class="material-symbols-outlined">star</span>`;
					bdiv.appendChild(star_button);

					star_button.addEventListener("click", async ev => {
						filemeta.starred = !filemeta.starred;
						await idbkv.set(entry.name, filemeta, filemeta_ikvs);
						file_div.classList.toggle("starred", filemeta.starred);
					});


					[file_div, upload_button].forEach(el => el.addEventListener("click", async ev => {
						if (ev.target != ev.currentTarget) return;
						const file = await entry.getFile();
						load_and_send_pcm(file);
					}));
				}
				filelist_div.append(file_div);
			}
		} else {
			// console.log("Ignoring non-file entry", entry);
		}
	}

	for (const file_div of filelist_files) {
		file_div.remove();
	}
}

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