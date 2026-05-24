package com.emomind.dto.response;

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
    private String fileName;
    private String fileType;
    private Integer fileSize;
    private String analysisResult;
    private String conversationId;
    private LocalDateTime createdAt;
    private UserResponse owner;
}
