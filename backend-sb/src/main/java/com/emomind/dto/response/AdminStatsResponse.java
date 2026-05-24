package com.emomind.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminStatsResponse {

    private long totalUsers;
    private long totalTestRecords;
    private long totalAnalysisReports;
    private long todayNewUsers;
    private long todayNewTestRecords;
    private long todayNewAnalysisReports;
}
