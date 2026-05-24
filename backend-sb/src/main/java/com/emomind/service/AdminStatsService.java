package com.emomind.service;

import com.emomind.dto.response.AdminStatsResponse;
import com.emomind.repository.FileAnalysisReportRepository;
import com.emomind.repository.TestRecordRepository;
import com.emomind.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Service
@RequiredArgsConstructor
public class AdminStatsService {

    private final UserRepository userRepository;
    private final TestRecordRepository testRecordRepository;
    private final FileAnalysisReportRepository fileAnalysisReportRepository;

    public AdminStatsResponse getStats() {
        LocalDateTime todayStart = LocalDate.now(ZoneId.of("Asia/Shanghai"))
                .atStartOfDay();

        return AdminStatsResponse.builder()
                .totalUsers(userRepository.count())
                .totalTestRecords(testRecordRepository.count())
                .totalAnalysisReports(fileAnalysisReportRepository.count())
                .todayNewUsers(userRepository.countByCreatedAtAfter(todayStart))
                .todayNewTestRecords(testRecordRepository.countByCreatedAtAfter(todayStart))
                .todayNewAnalysisReports(fileAnalysisReportRepository.countByCreatedAtAfter(todayStart))
                .build();
    }
}
