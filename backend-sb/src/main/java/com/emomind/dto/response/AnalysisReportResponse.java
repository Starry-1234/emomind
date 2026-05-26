package com.emomind.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalysisReportResponse {

    private UUID id;

    @JsonProperty("file_name")
    private String fileName;

    @JsonProperty("file_type")
    private String fileType;

    @JsonProperty("file_size")
    private Integer fileSize;

    @JsonProperty("analysis_result")
    private String analysisResult;

    @JsonProperty("conversation_id")
    private String conversationId;

    @JsonProperty("created_at")
    private LocalDateTime createdAt;

    private UserResponse owner;
}
