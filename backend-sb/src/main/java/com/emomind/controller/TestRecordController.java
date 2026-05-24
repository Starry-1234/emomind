package com.emomind.controller;

import com.emomind.dto.request.TestRecordCreateRequest;
import com.emomind.dto.request.TestRecordUpdateRequest;
import com.emomind.dto.response.MessageResponse;
import com.emomind.dto.response.PageResponse;
import com.emomind.dto.response.TestRecordResponse;
import com.emomind.security.UserDetailsImpl;
import com.emomind.service.TestRecordService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class TestRecordController {

    private final TestRecordService testRecordService;

    @GetMapping("/test-records/")
    public ResponseEntity<PageResponse<TestRecordResponse>> getRecords(
            @AuthenticationPrincipal UserDetailsImpl user,
            Pageable pageable) {
        return ResponseEntity.ok(testRecordService.getRecords(user.getId(), pageable));
    }

    @PostMapping("/test-records/")
    public ResponseEntity<TestRecordResponse> createRecord(
            @AuthenticationPrincipal UserDetailsImpl user,
            @Valid @RequestBody TestRecordCreateRequest request) {
        return ResponseEntity.ok(testRecordService.createRecord(user.getId(), request));
    }

    @GetMapping("/test-records/{id}")
    public ResponseEntity<TestRecordResponse> getRecord(
            @AuthenticationPrincipal UserDetailsImpl user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(testRecordService.getRecord(id, user.getId()));
    }

    @PutMapping("/test-records/{id}")
    public ResponseEntity<TestRecordResponse> updateRecord(
            @AuthenticationPrincipal UserDetailsImpl user,
            @PathVariable UUID id,
            @Valid @RequestBody TestRecordUpdateRequest request) {
        return ResponseEntity.ok(testRecordService.updateRecord(id, user.getId(), request));
    }

    @DeleteMapping("/test-records/{id}")
    public ResponseEntity<MessageResponse> deleteRecord(
            @AuthenticationPrincipal UserDetailsImpl user,
            @PathVariable UUID id) {
        testRecordService.deleteRecord(id, user.getId());
        return ResponseEntity.ok(new MessageResponse("Test record deleted successfully"));
    }

    @GetMapping("/admin/test-records")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PageResponse<TestRecordResponse>> getAllRecords(
            @RequestParam(required = false) UUID userId,
            Pageable pageable) {
        return ResponseEntity.ok(testRecordService.getAllRecords(userId, pageable));
    }

    @DeleteMapping("/admin/test-records/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<MessageResponse> deleteAnyRecord(@PathVariable UUID id) {
        testRecordService.deleteAnyRecord(id);
        return ResponseEntity.ok(new MessageResponse("Test record deleted successfully"));
    }
}
