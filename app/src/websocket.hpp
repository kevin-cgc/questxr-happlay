#pragma once

#include <spdlog/spdlog.h>
#include <libwebsockets.h>
#include <queue>
#include "openxr_program.hpp"

using HPBWSMessageHandler = std::function<void(const std::vector<uint8_t>& message, bool is_binary)> ;
using HPBWSLBIHandler = std::function<void()> ;

class HPB_WebsocketClient {
public:
	HPB_WebsocketClient();
	HPB_WebsocketClient(HPBWSMessageHandler msg_handler, HPBWSLBIHandler lbi_handler);
	~HPB_WebsocketClient();

	void connect();
	void disconnect();
	void send(std::string message);
	void service();

	static int callback_wrapper(struct lws* wsi, enum lws_callback_reasons reason, void* user, void* in, size_t len) {
		void* context_user = lws_context_user(lws_get_context(wsi));
		// spdlog::debug("context_user this {}", context_user);
        HPB_WebsocketClient* client = reinterpret_cast<HPB_WebsocketClient*>(context_user);
        return client->happlay_cb(wsi, reason, in, len);
    }

	std::optional<HPBWSMessageHandler> handle_message_external;
	std::optional<HPBWSLBIHandler> handle_incoming_long_binary_external;
private:
	struct lws_protocols protocols[2] = {
		{
			.name = "happlay",
			.callback = HPB_WebsocketClient::callback_wrapper, //make sure to set lws_protocols.user to `this`
			.per_session_data_size = 0,
			.rx_buffer_size =  4096,
			// .id = 0, // ignored by lws, i dont use it
			// .user = this // idk where this even comes out
		},
		{ NULL, NULL, 0, 0 } // terminator
	};

	size_t reconnect_attempts = 0;
	std::optional<std::chrono::time_point<std::chrono::steady_clock>> restart_after = std::nullopt;

	std::queue<std::string> msg_tx_queue;
	std::vector<uint8_t> send_buffer;
	std::optional<std::pair<size_t, size_t>> partial_send;

	bool conn_established = false;

	std::vector<uint8_t> msg_rx_buffer;

	int happlay_cb(struct lws* wsi, enum lws_callback_reasons reason, void* in, size_t len);

	void handle_message_internal(const std::vector<uint8_t>& message, bool is_binary);

	struct lws_context* context = nullptr;
	struct lws* wsi = nullptr;
};