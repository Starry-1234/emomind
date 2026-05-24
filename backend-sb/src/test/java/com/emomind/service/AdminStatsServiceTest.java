package com.emomind.service;

import com.emomind.dto.response.AdminStatsResponse;
import com.emomind.repository.FileAnalysisReportRepository;
import com.emomind.repository.TestRecordRepository;
import com.emomind.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminStatsServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private TestRecordRepository testRecordRepository;

    @Mock
    private FileAnalysisReportRepository fileAnalysisReportRepository;

    @InjectMocks
    private AdminStatsService adminStatsService;

    @Test
    void shouldReturnCorrectStats() {
        when(userRepository.count()).thenReturn(10L);
        when(testRecordRepository.count()).thenReturn(5L);
        when(fileAnalysisReportRepository.count()).thenReturn(3L);
        when(userRepository.countByCreatedAtAfter(any(LocalDateTime.class))).thenReturn(2L);
        when(testRecordRepository.countByCreatedAtAfter(any(LocalDateTime.class))).thenReturn(1L);
        when(fileAnalysisReportRepository.countByCreatedAtAfter(any(LocalDateTime.class))).thenReturn(0L);

        AdminStatsResponse result = adminStatsService.getStats();

        assertThat(result.getTotalUsers()).isEqualTo(10L);
        assertThat(result.getTotalTestRecords()).isEqualTo(5L);
        assertThat(result.getTotalAnalysisReports()).isEqualTo(3L);
        assertThat(result.getTodayNewUsers()).isEqualTo(2L);
        assertThat(result.getTodayNewTestRecords()).isEqualTo(1L);
        assertThat(result.getTodayNewAnalysisReports()).isEqualTo(0L);
    }
}
