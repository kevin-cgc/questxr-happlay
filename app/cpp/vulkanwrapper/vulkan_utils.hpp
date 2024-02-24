//
// Created by artyomd on 10/8/20.
//
#pragma once

#include <vulkan/vulkan.h>
#include <vector>

#include "data_type.hpp"
#include "redering_pipeline_config.hpp"

#include <string>

#define CHECK_VKCMD(x) \
	vulkan::CheckResult(x, __FILE__, __LINE__)

namespace vulkan {

void CheckResult(VkResult result, const std::string& file, uint32_t line);

std::vector<VkExtensionProperties> GetAvailableInstanceExtensions(std::string layer_name);

std::vector<VkLayerProperties> GetAvailableInstanceLayers();

VkBufferUsageFlags GetVkBufferUsage(BufferUsage buffer_usage);

VkMemoryPropertyFlags GetVkMemoryType(MemoryType memory_property);

VkIndexType GetVkType(DataType type);

VkFormat GetVkFormat(DataType type, uint32_t count);

VkPrimitiveTopology GetVkDrawMode(DrawMode draw_mode);

VkCullModeFlags GetVkCullMode(CullMode cull_mode);

VkFrontFace GetVkFrontFace(FrontFace front_face);

VkCompareOp GetVkCompareOp(CompareOp compare_op);

VkShaderStageFlagBits GetVkShaderStageFlag(ShaderType shader_type);
}  // namespace vulkan

constexpr uint8_t hexCharToUint(char c) {
	if (c >= '0' && c <= '9') return c - '0';
	if (c >= 'a' && c <= 'f') return 10 + c - 'a';
	if (c >= 'A' && c <= 'F') return 10 + c - 'A';
	throw std::invalid_argument("Invalid hex character");
}

constexpr VkClearColorValue hexToVkClearColorValue(const char* hex) {
	if (hex[0] != '#' || (hex[7] != '\0' && hex[9] != '\0')) {
		throw std::invalid_argument("Invalid hex color format");
	}
	return VkClearColorValue{
		{
			(hexCharToUint(hex[1]) * 16 + hexCharToUint(hex[2])) / 255.0f,
			(hexCharToUint(hex[3]) * 16 + hexCharToUint(hex[4])) / 255.0f,
			(hexCharToUint(hex[5]) * 16 + hexCharToUint(hex[6])) / 255.0f,
			hex[7] != '\0' ? (hexCharToUint(hex[7]) * 16 + hexCharToUint(hex[8])) / 255.0f : 1.0f  // Default alpha to 1.0 if not specified
		}};
}