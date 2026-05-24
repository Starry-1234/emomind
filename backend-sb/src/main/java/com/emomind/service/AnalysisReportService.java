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
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class AnalysisReportService {

    private final FileAnalysisReportRepository reportRepository;
    private final UserRepository userRepository;
    private final AnalysisReportMapper analysisReportMapper;

    @Transactional(readOnly = true)
    public PageResponse<AnalysisReportResponse> getReports(UUID ownerId, Pageable pageable) {
        var page = reportRepository.findByOwnerId(ownerId, pageable);
        return new PageResponse<>(analysisReportMapper.toResponseList(page.getContent()), page.getTotalElements());
    }

    public AnalysisReportResponse createReport(UUID ownerId, AnalysisReportCreateRequest request) {
        User owner = userRepository.findById(ownerId)
                .orElseThrow(() -> new UnauthorizedException("Could not validate credentials"));

        FileAnalysisReport report = FileAnalysisReport.builder()
                .fileName(request.getFileName())
                .fileType(request.getFileType())
                .fileSize(request.getFileSize())
                .analysisResult(request.getAnalysisResult())
                .conversationId(request.getConversationId())
                .owner(owner)
                .build();

        return analysisReportMapper.toResponse(reportRepository.save(report));
    }

    @Transactional(readOnly = true)
    public AnalysisReportResponse getReport(UUID reportId, UUID ownerId) {
        FileAnalysisReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResourceNotFoundException("Analysis report not found"));
        if (!report.getOwner().getId().equals(ownerId)) {
            throw new UnauthorizedException("Not enough permissions");
        }
        return analysisReportMapper.toResponse(report);
    }

    public void deleteReport(UUID reportId, UUID ownerId) {
        FileAnalysisReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResourceNotFoundException("Analysis report not found"));
        if (!report.getOwner().getId().equals(ownerId)) {
            throw new UnauthorizedException("Not enough permissions");
        }
        reportRepository.delete(report);
    }
}
