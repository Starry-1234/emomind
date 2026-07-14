package com.emomind.dto.response;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

public record ConversationMetaResponse(
    UUID id,
    String graph,
    String thread_id,
    String title,
    Map<String, Object> metadata,
    LocalDateTime created_at,
    LocalDateTime updated_at
) {}
