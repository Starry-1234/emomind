package com.emomind.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AnalysisReportCreateRequest {

    @NotBlank(message = "File name is required")
    @JsonProperty("file_name")
    private String fileName;

    @NotBlank(message = "File type is required")
    @JsonProperty("file_type")
    private String fileType;

    @JsonProperty("file_size")
    private Integer fileSize;

    @NotBlank(message = "Analysis result is required")
    @JsonProperty("analysis_result")
    private String analysisResult;

    @JsonProperty("conversation_id")
    private String conversationId;
}
