package com.emomind.dto.request;

import jakarta.validation.constraints.Email;
import lombok.Data;

@Data
public class UserUpdateRequest {
    @Email(message = "Invalid email format")
    private String email;
    private String fullName;
    private Boolean isActive;
    private Boolean isSuperuser;
    private String password;
}
