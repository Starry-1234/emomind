package com.emomind.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TestRecordResponse {

    private UUID id;
    private String testName;
    private String userTopic;
    private Integer totalScore;
    private Integer totalMax;
    private String resultDescription;
    private List<Map<String, Object>> questions;
    private List<Map<String, Object>> answers;
    private List<Map<String, Object>> scoringRanges;
    private String conversationId;
    private LocalDateTime createdAt;
    private UserResponse owner;
}
