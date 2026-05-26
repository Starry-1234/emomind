package com.emomind.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
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

    @JsonProperty("test_name")
    private String testName;

    @JsonProperty("user_topic")
    private String userTopic;

    @JsonProperty("total_score")
    private Integer totalScore;

    @JsonProperty("total_max")
    private Integer totalMax;

    @JsonProperty("result_description")
    private String resultDescription;

    private List<Map<String, Object>> questions;
    private List<Map<String, Object>> answers;

    @JsonProperty("scoring_ranges")
    private List<Map<String, Object>> scoringRanges;

    @JsonProperty("conversation_id")
    private String conversationId;

    @JsonProperty("created_at")
    private LocalDateTime createdAt;

    private UserResponse owner;
}
