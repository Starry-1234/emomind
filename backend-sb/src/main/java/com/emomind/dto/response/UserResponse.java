package com.emomind.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
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

    @JsonProperty("is_active")
    private Boolean active;

    @JsonProperty("is_superuser")
    private Boolean superuser;

    @JsonProperty("full_name")
    private String fullName;

    @JsonProperty("streak_days")
    private Integer streakDays;

    @JsonProperty("last_active_date")
    private LocalDateTime lastActiveDate;

    @JsonProperty("created_at")
    private LocalDateTime createdAt;
}
