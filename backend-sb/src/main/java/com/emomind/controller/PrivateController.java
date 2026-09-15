package com.emomind.controller;

import com.emomind.dto.request.UserRegisterRequest;
import com.emomind.dto.response.UserResponse;
import com.emomind.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Private (unauthenticated) endpoints, only intended for local dev / test
 * infrastructure. Originally lived under {@code /api/v1/private/*} in
 * {@code emomind-sb}; removed in M0 and re-introduced in M5 wrap-up so the
 * Playwright suite can seed users without first acquiring an admin token.
 *
 * <p>This controller is NOT gated by a Spring profile — the original
 * emomind-sb had it available in every environment and the Playwright
 * tests in {@code frontend/tests/utils/privateApi.ts} depend on it.
 * Production deployments should remove or restrict this controller
 * (e.g. via a reverse-proxy ACL) since it allows unauthenticated user
 * creation. See CLAUDE.md "M5 收尾" note.
 */
@RestController
@RequestMapping("/api/v1/private")
@RequiredArgsConstructor
@Tag(name = "Private", description = "Local-only unauthenticated helpers (test seeding)")
public class PrivateController {

    private final UserService userService;

    @PostMapping("/users")
    @Operation(summary = "Create a user without auth (test seeding only)")
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody UserRegisterRequest request) {
        // Note: extra fields on the request body (e.g. is_verified) are
        // silently ignored — Jackson's default is to ignore unknowns.
        return ResponseEntity.ok(userService.register(request));
    }
}
