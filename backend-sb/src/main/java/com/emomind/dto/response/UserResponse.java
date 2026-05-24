package com.emomind.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {
    private UUID id;
    private String email;
    private Boolean isActive;
    private Boolean isSuperuser;
    private String fullName;
    private Integer streakDays;
    private LocalDateTime lastActiveDate;
    private LocalDateTime createdAt;
}
