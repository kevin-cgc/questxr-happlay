#include "websocket.hpp"

#include <spdlog/spdlog.h>

#ifndef WS_SERVER_DOMAIN
#error "WS_SERVER_DOMAIN is not defined. Please define it in your build configuration."
#endif

// #define STRINGIFY(x) #x
// #define TOSTRING(x) STRINGIFY(x)
// #pragma message("WS_SERVER_DOMAIN is defined as: " WS_SERVER_DOMAIN)
// #pragma message("WS_SERVER_DOMAIN is defined as: " TOSTRING(WS_SERVER_DOMAIN))


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

        default:
            break;
    }

    return 0;
}


void HPB_WebsocketClient::connect() {
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
	if (context == NULL) {
		spdlog::error("lws init failed\n");
		return;
	}

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
	if (wsi == NULL) {
		spdlog::error("lws connection failed\n");
		return;
	}
}

void HPB_WebsocketClient::service() {
	lws_service(context, 0);
}
void HPB_WebsocketClient::disconnect() {
	lws_context_destroy(context);
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