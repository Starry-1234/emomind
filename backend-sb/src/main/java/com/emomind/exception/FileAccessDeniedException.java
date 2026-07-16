package com.emomind.exception;

/**
 * Raised by {@code AiProxyService.proxyFileDownload} when ai-runtime's
 * {@code GET /v1/files/{id}} returns 403 (FILE_ACCESS_DENIED) because the
 * requested file does not belong to the requesting user.
 *
 * <p>Mapped to HTTP 403 by {@code FileController.handleFileAccessDenied}.
 */
public class FileAccessDeniedException extends RuntimeException {
    public FileAccessDeniedException(String message) {
        super(message);
    }
}