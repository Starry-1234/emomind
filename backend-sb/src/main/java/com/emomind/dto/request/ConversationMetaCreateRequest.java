package com.emomind.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Map;

public record ConversationMetaCreateRequest(
    @NotBlank @Size(max = 64) String graph,
    @NotBlank @Size(max = 128) String thread_id,
    @Size(max = 255) String title,
    Map<String, Object> metadata
) {}
