// format_helpers.h
#pragma once

#include <spdlog/fmt/fmt.h>
#include <spirv_reflect.h>
#include <vulkan/vulkan.h>

inline auto format_as(SpvReflectResult f) { return fmt::underlying(f); }
inline auto format_as(VkResult f) { return fmt::underlying(f); }


