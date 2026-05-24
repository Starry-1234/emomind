package com.emomind.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AnalysisReportCreateRequest {

    @NotBlank(message = "File name is required")
    private String fileName;

    @NotBlank(message = "File type is required")
    private String fileType;

    private Integer fileSize;

    @NotBlank(message = "Analysis result is required")
    private String analysisResult;

    private String conversationId;
}
