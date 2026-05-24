package com.emomind.controller;

import com.emomind.dto.request.AnalysisReportCreateRequest;
import com.emomind.dto.response.AnalysisReportResponse;
import com.emomind.dto.response.MessageResponse;
import com.emomind.dto.response.PageResponse;
import com.emomind.security.UserDetailsImpl;
import com.emomind.service.AnalysisReportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/analysis/reports")
@RequiredArgsConstructor
public class AnalysisReportController {

    private final AnalysisReportService analysisReportService;

    @GetMapping("/")
    public ResponseEntity<PageResponse<AnalysisReportResponse>> getReports(
            @AuthenticationPrincipal UserDetailsImpl user,
            Pageable pageable) {
        return ResponseEntity.ok(analysisReportService.getReports(user.getId(), pageable));
    }

    @PostMapping("/")
    public ResponseEntity<AnalysisReportResponse> createReport(
            @AuthenticationPrincipal UserDetailsImpl user,
            @Valid @RequestBody AnalysisReportCreateRequest request) {
        return ResponseEntity.ok(analysisReportService.createReport(user.getId(), request));
    }

    @GetMapping("/{id}")
    public ResponseEntity<AnalysisReportResponse> getReport(
            @AuthenticationPrincipal UserDetailsImpl user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(analysisReportService.getReport(id, user.getId()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<MessageResponse> deleteReport(
            @AuthenticationPrincipal UserDetailsImpl user,
            @PathVariable UUID id) {
        analysisReportService.deleteReport(id, user.getId());
        return ResponseEntity.ok(new MessageResponse("Analysis report deleted successfully"));
    }
}
