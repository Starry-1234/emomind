package com.emomind.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class TestRecordCreateRequest {

    @NotBlank(message = "Test name is required")
    private String testName;

    private String userTopic;

    private Integer totalScore;

    private Integer totalMax;

    private String resultDescription;

    @NotNull(message = "Questions are required")
    private List<Map<String, Object>> questions;

    @NotNull(message = "Answers are required")
    private List<Map<String, Object>> answers;

    private List<Map<String, Object>> scoringRanges;

    private String conversationId;
}
