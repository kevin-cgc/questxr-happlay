#pragma once

#include <libwebsockets.h>
#include <queue>

class HPB_WebsocketClient {
public:
	HPB_WebsocketClient();
	~HPB_WebsocketClient();

	void connect();
	void disconnect();
	void send(const char* message);
	void service();

	static int callback_wrapper(struct lws* wsi, enum lws_callback_reasons reason, void* user, void* in, size_t len) {
        HPB_WebsocketClient* client = reinterpret_cast<HPB_WebsocketClient*>(user);
        return client->happlay_cb(wsi, reason, in, len);
    }

private:
	std::queue<const char *> msg_tx_queue;
	std::vector<uint8_t> send_buffer;
	std::optional<std::pair<size_t, size_t>> partial_send;

	int happlay_cb(struct lws* wsi, enum lws_callback_reasons reason, void* in, size_t len);


	struct lws_context* context;
	struct lws* wsi;
};