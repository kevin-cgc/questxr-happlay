//@ts-check

// @ts-ignore
import ngrok from "@ngrok/ngrok";
import { WebSocketServer, WebSocket } from "ws";
import express from "express";
// // @ts-ignore
// import multer from "multer";
// // @ts-ignore
// import { JSONFilePreset } from "lowdb/node";
import path from "path";
import crypto from "crypto";
import fs from "fs/promises";


/**
 *
 * @param {object} param0
 * @param {number} param0.controller_http_port
 * @param {number} param0.device_ws_port
 * @param {string} param0.participants_dir
 */
async function main({
	controller_http_port,
	device_ws_port,
	participants_dir,
}) {
	const app = express();
	const static_path = path.join(import.meta.dirname, "../frontend");
	app.use(express.static(static_path));

	await setup_api(app, participants_dir);

	const server = app.listen(controller_http_port, () => console.log(`Controller started on http://localhost:${controller_http_port}`));

	const controller_wss = new WebSocketServer({ server, path: "/ws" });
	const device_wss = new WebSocketServer({ port: device_ws_port });

	for (const config of [
		{ rx_wss: controller_wss, name: "controller", tx_wss: device_wss },
		{ rx_wss: device_wss, name: "device", tx_wss: controller_wss },
	]) {
		config.rx_wss.on("connection", (ws, req) => {
			console.log(`${config.name} connected from IP: ${req.socket.remoteAddress}`);

			ws.on("error", err => console.error(err));
			ws.on("close", () => { console.log(`${config.name} disconnected`); });

			ws.on("message", (message, isBinary) => {
				if (isBinary) {
					console.log(`Received ${config.name} binary message => ${message.slice.length} bytes`);
				} else {
					console.log(`Received ${config.name} message => ${message}`);
				}
				config.tx_wss.clients.forEach(client => {
					if (client.readyState === WebSocket.OPEN) {
						client.send(message, { binary: isBinary });
					}
				});
			});

			if (config.name === "device") {
				ws.send(JSON.stringify({ cmd: "getinfo" }));
			}
		});
	}

	console.log(`Oculus websocket server started on port ${device_ws_port}`);
}

function generate_uid() {
	return crypto.randomBytes(16).toString("hex");
}

class ExpressAppError extends Error {
	/**
	 *
	 * @param {number} status
	 * @param {string} message
	 */
	constructor(status, message) {
		super(message);
		this.status = status;
	}
}


/**
 * @param {express.Request} req
 * @throws {ExpressAppError}
 */
function get_participant_id_digest(req) {
	const participant_id = req.query.participant_id;
	if (!participant_id || typeof participant_id !== "string") {
		throw new ExpressAppError(400, "Participant ID is required");
	}
	const participant_id_digest = crypto.createHash("md5").update(PID_DIGEST_SALT).update(participant_id).digest("hex"); // wish this was async
	return { participant_id, participant_id_digest };
}
/**
 *
 * @param {express.Request | string} req_or_pid
 * @returns
 */
function get_participant_info_for_dir(participants_dir, req_or_pid) {
	let participant_id_digest;
	if (typeof req_or_pid === "string") {
		participant_id_digest = req_or_pid;
	} else {
		const participant_id_digest_provided = req_or_pid.query.participant_id_digest;
		if (!participant_id_digest_provided || typeof participant_id_digest_provided !== "string") {
			throw new ExpressAppError(400, "Participant ID digest must be a string");
		}
		participant_id_digest = participant_id_digest_provided;
	}


	const participant_dir = path.join(participants_dir, participant_id_digest);
	const participant_uploads_dir = path.join(participant_dir, "uploads");
	const participant_meta_file = path.join(participant_dir, "meta.json");
	return {
		participant_id_digest,
		participant_dir,
		participant_meta_file,
		participant_uploads_dir,
	};
}

const PID_DIGEST_SALT = "happlay_workshop1"
/**
 *
 * @param {express.Express} app
 */
async function setup_api(app, participants_dir) {
	const get_participant_info = req => get_participant_info_for_dir(participants_dir, req);
	const get_filename_from_params = req => get_filename_from_params_for_pdir(participants_dir, req);

	app.get("/api/participant", async (req, res) => {
		const { participant_id_digest } = get_participant_id_digest(req);
		const { participant_meta_file } = get_participant_info(participant_id_digest);
		try {
			const meta = JSON.parse(await fs.readFile(participant_meta_file, "utf-8"));
			res.json(meta);
		} catch (err) {
			if (err.code === "ENOENT") {
				res.status(404).send("Participant not found");
			} else throw err;
		}
	});
	app.post("/api/participant", async (req, res) => {
		const { participant_id, participant_id_digest } = get_participant_id_digest(req);
		const { participant_dir, participant_uploads_dir, participant_meta_file } = get_participant_info(participant_id_digest);

		if (await fs.access(participant_dir).then(() => true, () => false)) {
			throw new ExpressAppError(409, "Participant already exists");
		}

		const meta = {
			participant_id,
			participant_id_digest,
			created_at: Date.now(),
		};
		await fs.mkdir(participant_dir, { recursive: true });
		await fs.mkdir(participant_uploads_dir, { recursive: true });
		await fs.writeFile(participant_meta_file, JSON.stringify(meta, null, 2));

		res.json(meta);
	});

	app.get("/api/participant/files", async (req, res) => {
		const { participant_uploads_dir } = get_participant_info(req);
		const files = await fs.readdir(participant_uploads_dir);
		res.json(files);
	});
	app.get("/api/participant/file", async (req, res) => {
		const { file_path } = get_filename_from_params(req);

		res.sendFile(file_path);
	});
	app.get("/api/participant/file/meta", async (req, res) => {
		const { file_meta_path } = get_filename_from_params(req);

		const meta = JSON.parse(await fs.readFile(file_meta_path, "utf-8"));
		res.json(meta);
	});
	// app.use(express.text({ type: "application/json" }));
	app.put("/api/participant/file/meta", async (req, res) => {
		const { file_meta_path } = get_filename_from_params(req);

		/** @type {import("../frontend/js/folderfilepicker.mjs").FileEntryMeta} */
		const meta = JSON.parse(await fs.readFile(file_meta_path, "utf-8"));

		if (typeof req.query.starred == "string") meta.starred = req.query.starred === "true";
		if (typeof req.query.trash == "string") meta.trash = req.query.trash === "true";
		if (typeof req.query.vote == "string") meta.vote = parseFloat(req.query.vote);
		if (typeof req.query.playcount == "string") meta.playcount = parseInt(req.query.playcount);

		await fs.writeFile(file_meta_path, JSON.stringify(meta, null, 2));
		res.json(meta);
	});
	app.use(express.raw({ type: "audio/wav", limit: "20mb" }));
	app.put("/api/participant/file", async (req, res) => {
		const { file_path, file_meta_path, sanitized_filename } = get_filename_from_params(req);

		if (await fs.access(file_path).then(() => true, () => false)) {
			throw new ExpressAppError(409, "File already exists"); // might remove this later
		}

		const meta = {
			name: req.query.filename,
			filename: sanitized_filename,
			// sha256: crypto.createHash("sha256").update(req.body).digest("hex"),
			sha256: req.query.sha256,
			origin: req.query.origin,
			model: req.query.model,
			prompt: req.query.prompt,
			starred: req.query.starred === "true",
			trash: req.query.trash === "true",
			// @ts-ignore
			vote: parseFloat(req.query.vote) || 0,
			uploaded_at: Date.now(),
		};

		await fs.writeFile(file_meta_path, JSON.stringify(meta, null, 2));
		await fs.writeFile(file_path, req.body);
		res.send("OK");
	});


	// app.post("/api/uploadwav", wav_upload.single("wav"), async (req, res) => {
	// 	// @ts-ignore ????
	// 	const file = req.file;
	// 	if (!file) {
	// 		res.status(400).send("No file uploaded");
	// 		return;
	// 	}

	// 	console.log(`Received file ${file.originalname} with size ${file.size} bytes and saved as ${file.filename}`);
	// });
}

/**
 *
 * @param {string} filename
 * @returns {string} sanitized filename
 */
function sanitize_filename(filename) {
	return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * @param {express.Request} req
 */
function get_filename_from_params_for_pdir(participants_dir, req) {
	const { participant_uploads_dir } = get_participant_info_for_dir(participants_dir, req);

	const raw_filename = req.query.filename;
	if (!raw_filename || typeof raw_filename !== "string") {
		throw new ExpressAppError(400, "Filename is required");
	}
	const sanitized_filename = sanitize_filename(raw_filename);

	const file_path = path.join(participant_uploads_dir, sanitized_filename);
	const file_meta_path = path.join(participant_uploads_dir, sanitized_filename + ".json");

	return { file_path, file_meta_path, raw_filename, sanitized_filename };
}


const instance_num = Number.parseInt(process.argv[2]) || 1;

const BASE_CONTROLLER_HTTP_PORT = Number.parseInt(process.env["HAPPLAY_CONTROLLER_HTTP_PORT"] || "8081"); //isntancing: 8181, 8281, 8381...
const BASE_DEVICE_WS_PORT = Number.parseInt(process.env["HAPPLAY_DEVICE_WS_PORT"] || "8080"); // instancing: 8180, 8280, 8380...
const HAPPLAY_DATA_DIR = process.env["HAPPLAY_DATA_DIR"] || path.join(import.meta.dirname, "../data");
const PARTICIPANTS_DIR = path.join(HAPPLAY_DATA_DIR, "participants");

for (let i=0; i<instance_num; i++) {
	const controller_http_port = BASE_CONTROLLER_HTTP_PORT + i * 100;
	const device_ws_port = BASE_DEVICE_WS_PORT + i * 100;

	await main({
		controller_http_port,
		device_ws_port,
		participants_dir: PARTICIPANTS_DIR // all instances share the same participants dir, since participant ids should be unique across instances
	});
}