import { idbkv } from "../script.mjs";
import { load_and_send_pcm } from "./load_send_pcm.mjs";

const hapfilepicker_div = /** @type {HTMLDivElement} **/ (document.getElementById("hapfilepicker"));
const folderselect_div = /** @type {HTMLDivElement} **/ (hapfilepicker_div.querySelector("div .folderselect"));
const openfolder_button = /** @type {HTMLButtonElement} **/ (hapfilepicker_div.querySelector("button.openfolder"));
const openeddirectory_div = /** @type {HTMLDivElement} **/ (hapfilepicker_div.querySelector("div.openeddirectory"));
const changefolder_button = /** @type {HTMLButtonElement} **/ (openeddirectory_div.querySelector("button.changefolder"));
const opendirname_h2 = /** @type {HTMLHeadingElement} **/ (openeddirectory_div.querySelector("h2"));
const filelist_div = /** @type {HTMLDivElement} **/ (openeddirectory_div.querySelector(".filelist"));

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
		if (entry.kind == "file") {

			const fdiv = await (async () => {
				for (const fdiv of filelist_files) {
					if (await entry.isSameEntry(fdiv[SYMBOL_FILE_HANDLE])) return fdiv;
				}
				return null;
			})();

			if (fdiv) {
				filelist_files.delete(fdiv);
				continue;
			} else {
				const file_div = document.createElement("div");
				{ // init file_div
					file_div.className = "file";
					file_div[SYMBOL_FILE_HANDLE] = entry;

					const span = document.createElement("span");
					span.textContent = entry.name;
					file_div.appendChild(span);
					const button = document.createElement("button");
					button.textContent = "Upload";
					file_div.appendChild(button);

					file_div.addEventListener("click", async () => {
						const file = await entry.getFile();
						load_and_send_pcm(file);
					});
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