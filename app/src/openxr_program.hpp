#pragma once

#include "platform.hpp"

#include "graphics_plugin.hpp"

#include <array>
#include <map>

namespace side {
const int LEFT = 0;
const int RIGHT = 1;
const int COUNT = 2;
}  // namespace side

struct Swapchain {
	XrSwapchain handle;
	int32_t width;
	int32_t height;
};

struct InputState {
	XrActionSet action_set = XR_NULL_HANDLE;
	XrAction grab_action = XR_NULL_HANDLE;
	XrAction pose_action = XR_NULL_HANDLE;
	XrAction vibrate_action = XR_NULL_HANDLE;
	XrAction quit_action = XR_NULL_HANDLE;
	std::array<XrPath, side::COUNT> hand_subaction_path{};
	std::array<XrSpace, side::COUNT> hand_space{};
	std::array<float, side::COUNT> hand_scale = {{1.0f, 1.0f}};
	std::array<XrBool32, side::COUNT> hand_active{};

	// haptic feedback
	std::array<bool, side::COUNT> grab_was_active = {{false, false}};
	/// if playing, samples consumed
	std::array<std::optional<uint32_t>, side::COUNT> hap_samples_consumed = {{std::nullopt, std::nullopt}};
};

#include "../test_audio/dog_barking_haptic.pcm_f32le.hpp"

using WebSocketSendFunction = std::function<void(const std::string)>;
class OpenXrProgram {
   public:
	OpenXrProgram(std::shared_ptr<Platform> platform);

	void CreateInstance();
	void InitializeSystem();
	void InitializeSession();
	void CreateSwapchains();

	void handle_ws_message(const std::vector<uint8_t>& message, bool is_binary);
	void handle_ws_incoming_long_binary();
	void PollEvents();
	void PollActions();
	void RenderFrame();

	bool IsSessionRunning() const;

	~OpenXrProgram();

	std::optional<WebSocketSendFunction> ws_send;

   private:
	void send_ws_message(const std::string message);

	void InitializeActions();
	void CreateVisualizedSpaces();

	const XrEventDataBaseHeader *TryReadNextEvent();
	void HandleSessionStateChangedEvent(const XrEventDataSessionStateChanged &state_changed_event);
	bool RenderLayer(XrTime predicted_display_time,
					 std::vector<XrCompositionLayerProjectionView> &projection_layer_views,
					 XrCompositionLayerProjection &layer);

   private:
	bool loading_haptic_signal = false;
	std::vector<float> haptic_pcm_buffer = dog_barking_haptic_pcm_f32le;

	std::shared_ptr<Platform> platform_;
	std::shared_ptr<GraphicsPlugin> graphics_plugin_;

	XrInstance instance_ = XR_NULL_HANDLE;
	XrSystemId system_id_ = XR_NULL_SYSTEM_ID;
	XrSession session_ = XR_NULL_HANDLE;

	InputState input_{};

	std::vector<XrSpace> visualized_spaces_{};
	XrSpace app_space_ = XR_NULL_HANDLE;

	XrViewConfigurationType view_config_type_ = XR_VIEW_CONFIGURATION_TYPE_PRIMARY_STEREO;
	std::vector<XrViewConfigurationView> config_views_;
	std::vector<XrView> views_;

	std::vector<Swapchain> swapchains_;
	std::map<XrSwapchain, XrSwapchainImageBaseHeader *> swapchain_images_;

	XrEventDataBuffer event_data_buffer_{};

	XrSessionState session_state_ = XR_SESSION_STATE_UNKNOWN;
	bool session_running_ = false;
};

std::shared_ptr<OpenXrProgram> CreateOpenXrProgram(std::shared_ptr<Platform> platform);
