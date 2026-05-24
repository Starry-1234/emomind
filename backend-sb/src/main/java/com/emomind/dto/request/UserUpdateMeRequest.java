package com.emomind.dto.request;

import jakarta.validation.constraints.Email;
import lombok.Data;

@Data
public class UserUpdateMeRequest {
    @Email(message = "Invalid email format")
    private String email;
    private String fullName;
}
