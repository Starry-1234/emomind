package com.emomind.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Email;
import lombok.Data;

@Data
public class UserUpdateRequest {
    @Email(message = "Invalid email format")
    private String email;

    @JsonProperty("full_name")
    private String fullName;

    @JsonProperty("is_active")
    private Boolean active;

    @JsonProperty("is_superuser")
    private Boolean superuser;

    private String password;
}
