#include "websocket.hpp"

#include <spdlog/spdlog.h>

#ifndef WS_SERVER_DOMAIN
#error "WS_SERVER_DOMAIN is not defined. Please define it in your build configuration."
#endif

// #define STRINGIFY(x) #x
// #define TOSTRING(x) STRINGIFY(x)
// #pragma message("WS_SERVER_DOMAIN is defined as: " WS_SERVER_DOMAIN)
// #pragma message("WS_SERVER_DOMAIN is defined as: " TOSTRING(WS_SERVER_DOMAIN))

void lws_spdlog_emit_function(int level, const char* line);

int HPB_WebsocketClient::happlay_cb(struct lws* wsi, enum lws_callback_reasons reason, void* in, size_t len) {
    switch (reason) {
        case LWS_CALLBACK_CLIENT_ESTABLISHED:
            spdlog::info("Connection established\n");
            // Connection established
            break;

        case LWS_CALLBACK_CLIENT_RECEIVE:
            // Handle incoming messages here
            spdlog::info("Received data: %s\n", (const char*)in);
            break;

        case LWS_CALLBACK_CLIENT_CONNECTION_ERROR:
            lwsl_err("Connection error\n");
            // Handle connection error
            break;

        case LWS_CALLBACK_CLIENT_CLOSED:
            spdlog::info("Connection closed\n");
            // Cleanup and possibly reconnect
            break;

		case LWS_CALLBACK_CLIENT_WRITEABLE:
			spdlog::debug("WebSocket is writeable: LWS_CALLBACK_CLIENT_WRITEABLE");
			if (msg_tx_queue.size() > 0) {
				size_t start_send_idx = 0;
				size_t remaining_length = 0;
				size_t message_len = 0;

				if (partial_send.has_value()) {
					start_send_idx = partial_send.value().first;
					message_len = partial_send.value().second;
					remaining_length = message_len - start_send_idx;
				} else {
					const char* message = msg_tx_queue.front();
					message_len = strlen(message);

					// Ensure the send buffer is large enough, including LWS_PRE space
					if (send_buffer.capacity() < message_len + LWS_PRE) {
						send_buffer.resize(message_len + LWS_PRE);
					}
					// Copy the message into the send buffer, respecting LWS_PRE
					memcpy(&send_buffer[LWS_PRE], message, message_len);
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
                } else {
                    msg_tx_queue.pop(); // Remove the message from the queue if sent successfully
					partial_send.reset();
                }
			}
			break;

        default:
            break;
    }

    return 0;
}


void HPB_WebsocketClient::connect() {
	spdlog::info("Starting websocket for {}", WS_SERVER_DOMAIN);
	lws_set_log_level(LLL_ERR | LLL_WARN | LLL_NOTICE | LLL_INFO | LLL_DEBUG, lws_spdlog_emit_function);

	struct lws_context_creation_info info;
	memset(&info, 0, sizeof(info));

	info.port = CONTEXT_PORT_NO_LISTEN; // We don't run a server
	const struct lws_protocols protocols[] = {
		{
			"happlay",
			HPB_WebsocketClient::callback_wrapper, //make sure to set info.user to `this`
			0,
			4096,
		},
		{ NULL, NULL, 0, 0 } // terminator
	};
	info.protocols = protocols;
	info.gid = -1;
	info.uid = -1;
	info.user = this;

	context = lws_create_context(&info);
	if (context == NULL) throw std::runtime_error("lws context creation failed");

	struct lws_client_connect_info connect_info = {
		.context = context,
		.address = WS_SERVER_DOMAIN,
		.port = 80,
		.ssl_connection = false,
		.path = "/", // Adjust according to your server's path
		.host = lws_canonical_hostname(context),
		.origin = "origin",
		.protocol = protocols[0].name,
	};

	wsi = lws_client_connect_via_info(&connect_info);
	if (wsi == NULL) throw std::runtime_error("lws connection failed");

	spdlog::info("lws connection success");
}

void HPB_WebsocketClient::service() {
	auto res = lws_service(context, 0);
	if (res < 0) {
		spdlog::error("lws_service failed: {}", res);
	}
}
void HPB_WebsocketClient::disconnect() {
	lws_context_destroy(context);
}

void HPB_WebsocketClient::send(const char* message) {
	if (wsi == nullptr) {
		spdlog::error("Websocket is not connected");
		return;
	}

	spdlog::debug("Queuing message to send: {}", message);
	msg_tx_queue.push(message);

	auto res = lws_callback_on_writable(wsi);
	if (res != 0) {
		spdlog::error("Failed to set callback on writable: {}", res);
	}
}


HPB_WebsocketClient::HPB_WebsocketClient() {
	context = nullptr;
	wsi = nullptr;
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
