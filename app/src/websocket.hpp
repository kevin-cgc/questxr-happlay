#pragma once

#include <spdlog/spdlog.h>
#include <libwebsockets.h>
#include <queue>

class HPB_WebsocketClient {
public:
	HPB_WebsocketClient();
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

private:
	std::queue<std::string> msg_tx_queue;
	std::vector<uint8_t> send_buffer;
	std::optional<std::pair<size_t, size_t>> partial_send;

	bool conn_established = false;

	std::vector<uint8_t> msg_rx_buffer;

	int happlay_cb(struct lws* wsi, enum lws_callback_reasons reason, void* in, size_t len);

	void handle_message(const std::vector<uint8_t>& message, bool is_binary);


	struct lws_context* context;
	struct lws* wsi;
};