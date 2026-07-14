package com.emomind.controller;

import com.emomind.exception.FileAccessDeniedException;
import com.emomind.security.UserDetailsImpl;
import com.emomind.service.AiProxyService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ai/files")
public class FileController {

    private static final Logger log = LoggerFactory.getLogger(FileController.class);
    private final AiProxyService aiProxyService;

    public FileController(AiProxyService aiProxyService) {
        this.aiProxyService = aiProxyService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> upload(@RequestParam("file") MultipartFile file) {
        UUID userId = currentUserId();
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }
        log.info("file upload user={} name={} size={}", userId, file.getOriginalFilename(), file.getSize());
        Map<String, Object> result = aiProxyService.proxyFileUpload(file, userId);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{fileId}")
    public Mono<ResponseEntity<byte[]>> download(@PathVariable String fileId) {
        UUID userId = currentUserId();
        if (userId == null) {
            return Mono.just(ResponseEntity.status(401).build());
        }
        log.info("file download user={} file_id={}", userId, fileId);
        return aiProxyService.proxyFileDownload(fileId, userId)
            .map(bytes -> ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(bytes));
    }

    private UUID currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return null;
        }
        Object principal = auth.getPrincipal();
        if (principal instanceof UserDetailsImpl u) {
            return u.getId();
        }
        return UUID.fromString(auth.getName());
    }

    /**
     * M4 T2: ai-runtime returns 403 (FILE_ACCESS_DENIED) when the requested
     * file belongs to a different user. Map that to a structured 403 JSON
     * for the frontend instead of leaking the underlying WebClient error.
     */
    @ExceptionHandler(FileAccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleFileAccessDenied(FileAccessDeniedException e) {
        return ResponseEntity.status(403).body(Map.of(
            "code", "FILE_ACCESS_DENIED",
            "message", e.getMessage()
        ));
    }
}