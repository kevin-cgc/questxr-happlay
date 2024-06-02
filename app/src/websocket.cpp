#include "websocket.hpp"

#include <spdlog/spdlog.h>

#ifndef WS_SERVER_DOMAIN
#error "WS_SERVER_DOMAIN is not defined. Please define it in your build configuration."
#endif
#ifndef WS_SERVER_PORT
#error "WS_SERVER_PORT is not defined. Please define it in your build configuration."
#endif

// #define STRINGIFY(x) #x
// #define TOSTRING(x) STRINGIFY(x)
// #pragma message("WS_SERVER_DOMAIN is defined as: " WS_SERVER_DOMAIN)
// #pragma message("WS_SERVER_DOMAIN is defined as: " TOSTRING(WS_SERVER_DOMAIN))

void lws_spdlog_emit_function(int level, const char* line);

void HPB_WebsocketClient::handle_message_internal(const std::vector<uint8_t>& message, bool is_binary) {
	if (is_binary) {
		spdlog::info("WS rx binary msg len: {}", message.size());
	} else {
		spdlog::info("WS rx text msg: {}", std::string(message.begin(), message.end()));
	}

	if (this->handle_message_external.has_value()) this->handle_message_external.value()(message, is_binary);
}

int HPB_WebsocketClient::happlay_cb(struct lws* wsi, enum lws_callback_reasons reason, void* in, size_t len) {
    switch (reason) {
        case LWS_CALLBACK_CLIENT_ESTABLISHED: {
            spdlog::info("WS Connection established");
            this->conn_established = true;
			this->reconnect_attempts = 0;
            break;
		}

        case LWS_CALLBACK_CLIENT_RECEIVE: {
            // Handle incoming messages here

			const char* incoming_data = reinterpret_cast<const char*>(in);
			const size_t remaining = lws_remaining_packet_payload(wsi);
			if (!remaining && lws_is_final_fragment(wsi)) {
				this->msg_rx_buffer.insert(this->msg_rx_buffer.end(), incoming_data, incoming_data + len);
				this->handle_message_internal(this->msg_rx_buffer, lws_frame_is_binary(wsi));
				this->msg_rx_buffer.clear();
			} else {
				this->msg_rx_buffer.insert(this->msg_rx_buffer.end(), incoming_data, incoming_data + len);
				if (lws_frame_is_binary(wsi)) {
					// spdlog::debug("long binary incoming...");
					if (this->handle_incoming_long_binary_external.has_value()) this->handle_incoming_long_binary_external.value()();
				}
			}

            break;
		}

        case LWS_CALLBACK_CLIENT_CONNECTION_ERROR: {
            spdlog::error("WS Connection error");
            if (!this->conn_established) {
				// fall through to LWS_CALLBACK_CLOSED
			} else {
            	break;
			}
		}

        case LWS_CALLBACK_CLIENT_CLOSED: {
            spdlog::info("WS Connection closed");
            // try to reconnect
			this->conn_established = false;
			this->wsi = nullptr;
			this->restart_after = std::chrono::steady_clock::now() + std::chrono::seconds(std::max(2 * (int)this->reconnect_attempts, 10));
            break;
		}

		case LWS_CALLBACK_CLIENT_WRITEABLE: {
			// spdlog::debug("WebSocket is writeable: LWS_CALLBACK_CLIENT_WRITEABLE");
			// spdlog::debug("WS TX Queue size: {}", msg_tx_queue.size());

			if (msg_tx_queue.size() > 0) {
				size_t start_send_idx = 0;
				size_t remaining_length = 0;
				size_t message_len = 0;

				if (partial_send.has_value()) {
					start_send_idx = partial_send.value().first;
					message_len = partial_send.value().second;
					remaining_length = message_len - start_send_idx;
				} else {
					std::string message = msg_tx_queue.front();
					message_len = message.length();

					// Ensure the send buffer is large enough, including LWS_PRE space
					if (send_buffer.capacity() < message_len + LWS_PRE) {
						send_buffer.resize(message_len + LWS_PRE);
					}
					// Copy the message into the send buffer, respecting LWS_PRE
					memcpy(&send_buffer[LWS_PRE], message.c_str(), message_len);
					start_send_idx = LWS_PRE;
					remaining_length = message_len;
				}

				int bytes_sent = lws_write(wsi, &send_buffer[start_send_idx], remaining_length, LWS_WRITE_TEXT);
				spdlog::debug("WebSocket sent {} bytes", bytes_sent);

				if (bytes_sent < 0) {
					spdlog::error("Failed to send websocket message: {}", bytes_sent);
					return -1;
				} else if (bytes_sent < static_cast<int>(remaining_length)) {
                    partial_send = {start_send_idx + bytes_sent, message_len};
					// lws_callback_on_writable needs to be called (is below)
                } else {
                    msg_tx_queue.pop(); // Remove the message from the queue if sent successfully
					partial_send.reset();
                }
			}
			break;
		}

        default: {
            break;
		}
    }

	// spdlog::debug("Queue size: {}", msg_tx_queue.size());
	// check if there are messages in the queue and if connection has been established
	if (msg_tx_queue.size() > 0 && this->conn_established) {
		spdlog::debug("WS TX Queue size = {} so lws_callback_on_writable", msg_tx_queue.size());
		auto res = lws_callback_on_writable(wsi);
		// spdlog::debug("Queue size: {}, so lws_callback_on_writable(wsi) which returned {}", msg_tx_queue.size(), res);
	}

    return 0;
}


void HPB_WebsocketClient::connect() {
	static const uint32_t backoff_ms[] = { 1000, 2000, 3000, 4000, 5000 };
	static const lws_retry_bo_t retry = {
		.retry_ms_table = backoff_ms, // i dont use this, i think its just for sul w event loops?
		.retry_ms_table_count = LWS_ARRAY_SIZE(backoff_ms),
		.conceal_count = 500,

		.secs_since_valid_ping = 24, /* force PINGs after secs idle */
		.secs_since_valid_hangup = 52, /* hangup after secs idle */

		.jitter_percent = 20,
	};

	struct lws_client_connect_info connect_info = {
		.context = context,
		.address = WS_SERVER_DOMAIN, //"10.20.0.100"
		.port = WS_SERVER_PORT, // 8080,
		.ssl_connection = false,
		.path = "/",
		.host = WS_SERVER_DOMAIN, //lws_canonical_hostname(context),
		.origin = WS_SERVER_DOMAIN,
		.protocol = protocols[0].name,
		.retry_and_idle_policy = &retry,
	};

	wsi = lws_client_connect_via_info(&connect_info);
	if (wsi == NULL) throw std::runtime_error("lws connection failed");

	spdlog::info("lws connecting to {}:{} ...", WS_SERVER_DOMAIN, WS_SERVER_PORT);
}

void HPB_WebsocketClient::service() {
	if (restart_after.has_value() && std::chrono::steady_clock::now() > restart_after.value()) {
		this->reconnect_attempts++;
		spdlog::info("Reconnecting to websocket (attempt {})", this->reconnect_attempts);
		connect();
		restart_after.reset();
	}

	auto res = lws_service(context, -1); // -1 is non-blocking
	// spdlog::debug("lws_service returned: {}", res);
	if (res < 0) spdlog::error("lws_service failed: {}", res);
}
void HPB_WebsocketClient::disconnect() {
	lws_context_destroy(context);
}

void HPB_WebsocketClient::send(std::string message) {
	if (wsi == nullptr) {
		spdlog::error("Websocket is not connected");
		return;
	}

	spdlog::debug("WS Queuing message to send: {}", message);
	msg_tx_queue.push(message);

	auto res = lws_callback_on_writable(wsi);
	// if (res != 0) spdlog::error("Failed lws_callback_on_writable: {}", res); //idc
}


HPB_WebsocketClient::HPB_WebsocketClient() {
	// lws_set_log_level(LLL_ERR | LLL_WARN | LLL_NOTICE | LLL_INFO | LLL_DEBUG, lws_spdlog_emit_function);
	// lws_set_log_level(LLL_ERR | LLL_WARN | LLL_NOTICE | LLL_INFO, lws_spdlog_emit_function);
	lws_set_log_level(LLL_ERR | LLL_WARN | LLL_NOTICE, lws_spdlog_emit_function);
	spdlog::info("Starting websocket for " WS_SERVER_DOMAIN);

	struct lws_context_creation_info info;
	memset(&info, 0, sizeof(info));

	info.port = CONTEXT_PORT_NO_LISTEN; // We don't run a server
	info.protocols = protocols;
	info.gid = -1;
	info.uid = -1;
	// spdlog::debug("setting this {}", (size_t)this);
	info.user = this; // this is used in the callback_wrapper (lws_context_user(lws_get_context(wsi)))

	context = lws_create_context(&info);
	if (context == NULL) throw std::runtime_error("lws context creation failed");
}
HPB_WebsocketClient::HPB_WebsocketClient(HPBWSMessageHandler msg_handler, HPBWSLBIHandler lbi_handler) {
	HPB_WebsocketClient();
	handle_message_external = msg_handler;
	handle_incoming_long_binary_external = lbi_handler;
}

HPB_WebsocketClient::~HPB_WebsocketClient() {
	if (context != nullptr) {
		lws_context_destroy(context);
	}
}



void lws_spdlog_emit_function(int level, const char* line) {
    // Map libwebsockets log levels to spdlog levels
    // Note: You might need to adjust the mapping based on your preferences
    spdlog::level::level_enum spdlog_level = spdlog::level::info; // Default level
    switch (level) {
        case LLL_ERR:
            spdlog_level = spdlog::level::err;
            break;
        case LLL_WARN:
            spdlog_level = spdlog::level::warn;
            break;
        case LLL_NOTICE:
            spdlog_level = spdlog::level::info;
            break;
        case LLL_INFO:
            spdlog_level = spdlog::level::info;
            break;
        case LLL_DEBUG:
            spdlog_level = spdlog::level::debug;
            break;
        case LLL_PARSER:
        case LLL_HEADER:
        case LLL_EXT:
        case LLL_CLIENT:
        case LLL_LATENCY:
        case LLL_USER:
            spdlog_level = spdlog::level::trace;
            break;
    }

    // Forward the log message to spdlog
    spdlog::log(spdlog_level, line);
}
