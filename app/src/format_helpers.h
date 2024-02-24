// format_helpers.h
#pragma once

#include <spdlog/fmt/fmt.h>
#include "platform.hpp"

inline auto format_as(XrResult f) { return fmt::underlying(f); }
inline auto format_as(XrSessionState f) { return fmt::underlying(f); }
inline auto format_as(XrStructureType f) { return fmt::underlying(f); }