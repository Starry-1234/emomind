package com.emomind.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminStatsResponse {

    @JsonProperty("total_users")
    private long totalUsers;

    @JsonProperty("total_test_records")
    private long totalTestRecords;

    @JsonProperty("total_analysis_reports")
    private long totalAnalysisReports;

    @JsonProperty("today_new_users")
    private long todayNewUsers;

    @JsonProperty("today_new_test_records")
    private long todayNewTestRecords;

    @JsonProperty("today_new_analysis_reports")
    private long todayNewAnalysisReports;
}
