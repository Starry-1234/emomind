package com.emomind.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class TestRecordCreateRequest {

    @NotBlank(message = "Test name is required")
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

    @NotNull(message = "Questions are required")
    private List<Map<String, Object>> questions;

    @NotNull(message = "Answers are required")
    private List<Map<String, Object>> answers;

    @JsonProperty("scoring_ranges")
    private List<Map<String, Object>> scoringRanges;

    @JsonProperty("conversation_id")
    private String conversationId;
}
