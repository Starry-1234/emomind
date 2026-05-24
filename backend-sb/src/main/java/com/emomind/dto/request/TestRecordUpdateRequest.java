package com.emomind.dto.request;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class TestRecordUpdateRequest {

    private String testName;
    private String userTopic;
    private Integer totalScore;
    private Integer totalMax;
    private String resultDescription;
    private List<Map<String, Object>> questions;
    private List<Map<String, Object>> answers;
    private List<Map<String, Object>> scoringRanges;
    private String conversationId;
}
