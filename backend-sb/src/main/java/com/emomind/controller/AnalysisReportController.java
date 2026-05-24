package com.emomind.controller;

import com.emomind.dto.request.AnalysisReportCreateRequest;
import com.emomind.dto.response.AnalysisReportResponse;
import com.emomind.dto.response.MessageResponse;
import com.emomind.dto.response.PageResponse;
import com.emomind.security.UserDetailsImpl;
import com.emomind.service.AnalysisReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "Analysis Reports", description = "文件分析报告管理")
public class AnalysisReportController {

    private final AnalysisReportService analysisReportService;

    @GetMapping("/")
    @Operation(summary = "获取当前用户的分析报告列表")
    public ResponseEntity<PageResponse<AnalysisReportResponse>> getReports(
            @AuthenticationPrincipal UserDetailsImpl user,
            Pageable pageable) {
        return ResponseEntity.ok(analysisReportService.getReports(user.getId(), pageable));
    }

    @PostMapping("/")
    @Operation(summary = "创建新的分析报告")
    public ResponseEntity<AnalysisReportResponse> createReport(
            @AuthenticationPrincipal UserDetailsImpl user,
            @Valid @RequestBody AnalysisReportCreateRequest request) {
        return ResponseEntity.ok(analysisReportService.createReport(user.getId(), request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取指定分析报告的详情")
    public ResponseEntity<AnalysisReportResponse> getReport(
            @AuthenticationPrincipal UserDetailsImpl user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(analysisReportService.getReport(id, user.getId()));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除指定的分析报告")
    public ResponseEntity<MessageResponse> deleteReport(
            @AuthenticationPrincipal UserDetailsImpl user,
            @PathVariable UUID id) {
        analysisReportService.deleteReport(id, user.getId());
        return ResponseEntity.ok(new MessageResponse("Analysis report deleted successfully"));
    }
}
