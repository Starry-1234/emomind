package com.emomind.controller;

import com.emomind.dto.request.*;
import com.emomind.dto.response.*;
import com.emomind.security.UserDetailsImpl;
import com.emomind.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "Users", description = "用户管理")
public class UserController {

    private final UserService userService;

    @GetMapping("/")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "管理员获取所有用户列表")
    public ResponseEntity<PageResponse<UserResponse>> getAllUsers(Pageable pageable) {
        return ResponseEntity.ok(userService.getAllUsers(pageable));
    }

    @PostMapping("/")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "管理员创建新用户")
    public ResponseEntity<UserResponse> createUser(@Valid @RequestBody UserCreateRequest request) {
        return ResponseEntity.ok(userService.createUser(request));
    }

    @GetMapping("/me")
    @Operation(summary = "获取当前登录用户信息")
    public ResponseEntity<UserResponse> getCurrentUser(@AuthenticationPrincipal UserDetailsImpl user) {
        return ResponseEntity.ok(userService.getCurrentUser(user.getId()));
    }

    @PatchMapping("/me")
    @Operation(summary = "更新当前登录用户信息")
    public ResponseEntity<UserResponse> updateCurrentUser(
            @AuthenticationPrincipal UserDetailsImpl user,
            @Valid @RequestBody UserUpdateMeRequest request) {
        return ResponseEntity.ok(userService.updateCurrentUser(user.getId(), request));
    }

    @DeleteMapping("/me")
    @Operation(summary = "删除当前登录用户账号")
    public ResponseEntity<MessageResponse> deleteCurrentUser(@AuthenticationPrincipal UserDetailsImpl user) {
        userService.deleteCurrentUser(user.getId());
        return ResponseEntity.ok(new MessageResponse("User deleted successfully"));
    }

    @PatchMapping("/me/password")
    @Operation(summary = "修改当前用户密码")
    public ResponseEntity<MessageResponse> updatePassword(
            @AuthenticationPrincipal UserDetailsImpl user,
            @Valid @RequestBody UpdatePasswordRequest request) {
        userService.updatePassword(user.getId(), request);
        return ResponseEntity.ok(new MessageResponse("Password updated successfully"));
    }

    @PostMapping("/signup")
    @Operation(summary = "用户注册")
    public ResponseEntity<UserResponse> signup(@Valid @RequestBody UserRegisterRequest request) {
        return ResponseEntity.ok(userService.register(request));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "管理员获取指定用户信息")
    public ResponseEntity<UserResponse> getUserById(@PathVariable UUID id) {
        return ResponseEntity.ok(userService.getCurrentUser(id));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "管理员更新指定用户信息")
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable UUID id,
            @Valid @RequestBody UserUpdateRequest request) {
        return ResponseEntity.ok(userService.updateUser(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "管理员删除指定用户")
    public ResponseEntity<MessageResponse> deleteUser(@PathVariable UUID id) {
        userService.deleteUser(id);
        return ResponseEntity.ok(new MessageResponse("User deleted successfully"));
    }
}
