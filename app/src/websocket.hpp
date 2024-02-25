#pragma once

#include <libwebsockets.h>


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

	int happlay_cb(struct lws* wsi, enum lws_callback_reasons reason, void* in, size_t len);


	struct lws_context* context;
	struct lws* wsi;
};