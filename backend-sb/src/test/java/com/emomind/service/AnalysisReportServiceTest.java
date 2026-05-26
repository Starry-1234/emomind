package com.emomind.service;

import com.emomind.dto.request.AnalysisReportCreateRequest;
import com.emomind.dto.response.AnalysisReportResponse;
import com.emomind.dto.response.PageResponse;
import com.emomind.entity.FileAnalysisReport;
import com.emomind.entity.User;
import com.emomind.exception.ResourceNotFoundException;
import com.emomind.exception.UnauthorizedException;
import com.emomind.mapper.AnalysisReportMapper;
import com.emomind.repository.FileAnalysisReportRepository;
import com.emomind.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AnalysisReportServiceTest {

    @Mock
    private FileAnalysisReportRepository reportRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private AnalysisReportMapper analysisReportMapper;

    @InjectMocks
    private AnalysisReportService analysisReportService;

    @Test
    void shouldCreateReportSuccessfully() {
        UUID ownerId = UUID.randomUUID();
        User owner = User.builder().id(ownerId).build();
        AnalysisReportCreateRequest request = new AnalysisReportCreateRequest();
        request.setFileName("report.pdf");
        request.setFileType("application/pdf");
        request.setAnalysisResult("Result");

        when(userRepository.findById(ownerId)).thenReturn(Optional.of(owner));
        when(reportRepository.save(any(FileAnalysisReport.class))).thenAnswer(inv -> inv.getArgument(0));
        when(analysisReportMapper.toResponse(any(FileAnalysisReport.class))).thenReturn(new AnalysisReportResponse());

        AnalysisReportResponse result = analysisReportService.createReport(ownerId, request);

        assertThat(result).isNotNull();
        verify(reportRepository).save(any(FileAnalysisReport.class));
    }

    @Test
    void shouldThrowWhenOwnerNotFoundOnCreate() {
        UUID ownerId = UUID.randomUUID();
        AnalysisReportCreateRequest request = new AnalysisReportCreateRequest();

        when(userRepository.findById(ownerId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> analysisReportService.createReport(ownerId, request))
                .isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void shouldGetReportForOwner() {
        UUID ownerId = UUID.randomUUID();
        UUID reportId = UUID.randomUUID();
        User owner = User.builder().id(ownerId).build();
        FileAnalysisReport report = FileAnalysisReport.builder().id(reportId).owner(owner).build();

        when(reportRepository.findById(reportId)).thenReturn(Optional.of(report));
        when(analysisReportMapper.toResponse(report)).thenReturn(new AnalysisReportResponse());

        AnalysisReportResponse result = analysisReportService.getReport(reportId, ownerId);

        assertThat(result).isNotNull();
    }

    @Test
    void shouldThrowWhenReportNotFound() {
        UUID reportId = UUID.randomUUID();
        when(reportRepository.findById(reportId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> analysisReportService.getReport(reportId, UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Analysis report not found");
    }

    @Test
    void shouldThrowWhenAccessingOthersReport() {
        UUID ownerId = UUID.randomUUID();
        UUID otherId = UUID.randomUUID();
        UUID reportId = UUID.randomUUID();
        User owner = User.builder().id(ownerId).build();
        FileAnalysisReport report = FileAnalysisReport.builder().id(reportId).owner(owner).build();

        when(reportRepository.findById(reportId)).thenReturn(Optional.of(report));

        assertThatThrownBy(() -> analysisReportService.getReport(reportId, otherId))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("权限不足");
    }

    @Test
    void shouldDeleteReportSuccessfully() {
        UUID ownerId = UUID.randomUUID();
        UUID reportId = UUID.randomUUID();
        User owner = User.builder().id(ownerId).build();
        FileAnalysisReport report = FileAnalysisReport.builder().id(reportId).owner(owner).build();

        when(reportRepository.findById(reportId)).thenReturn(Optional.of(report));

        analysisReportService.deleteReport(reportId, ownerId);

        verify(reportRepository).delete(report);
    }

    @Test
    void shouldGetReportsForOwner() {
        UUID ownerId = UUID.randomUUID();
        Page<FileAnalysisReport> page = new PageImpl<>(List.of(FileAnalysisReport.builder().build()));
        when(reportRepository.findByOwnerId(eq(ownerId), any(PageRequest.class))).thenReturn(page);
        when(analysisReportMapper.toResponseList(any())).thenReturn(List.of(new AnalysisReportResponse()));

        PageResponse<AnalysisReportResponse> result = analysisReportService.getReports(ownerId, PageRequest.of(0, 10));

        assertThat(result.getCount()).isEqualTo(1);
    }
}
