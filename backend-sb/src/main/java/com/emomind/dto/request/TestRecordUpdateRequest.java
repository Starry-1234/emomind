package com.emomind.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class TestRecordUpdateRequest {

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
}
