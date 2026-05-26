package com.emomind.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Email;
import lombok.Data;

@Data
public class UserUpdateMeRequest {
    @Email(message = "Invalid email format")
    private String email;

    @JsonProperty("full_name")
    private String fullName;
}
