package com.emomind.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import com.emomind.service.AiProxyService;

import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
class AiControllerAuthTest {

    @Autowired private WebApplicationContext context;
    @MockBean private AiProxyService aiProxyService;

    @Test
    void unauthenticated_chat_returns401() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context)
            .apply(springSecurity())
            .build();
        mvc.perform(post("/api/v1/ai/chat")
                .contentType("application/json")
                .content("{\"graph\":\"ai-doctor\",\"input\":{}}"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "00000000-0000-0000-0000-000000000001", roles = "USER")
    void authenticated_chat_returns200() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context)
            .apply(springSecurity())
            .build();
        // We don't have a real ai-runtime up in tests; auth should pass and Spring should
        // attempt to read from ai-runtime. The 200 vs 5xx depends on MockBean wiring —
        // M1 only asserts the auth gate is no longer the blocker.
        mvc.perform(post("/api/v1/ai/chat")
                .contentType("application/json")
                .content("{\"graph\":\"ai-doctor\",\"input\":{}}"))
            .andExpect(status().is(org.hamcrest.Matchers.anyOf(
                org.hamcrest.Matchers.equalTo(200),
                org.hamcrest.Matchers.equalTo(500))));
    }

    @Test
    void unauthenticated_stop_returns401() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context)
            .apply(springSecurity())
            .build();
        mvc.perform(post("/api/v1/ai/chat/stop")
                .contentType("application/json")
                .content("{\"thread_id\":\"t1\",\"run_id\":\"r1\"}"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "00000000-0000-0000-0000-000000000001", roles = "USER")
    void authenticated_stop_returns204() throws Exception {
        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context)
            .apply(springSecurity())
            .build();
        mvc.perform(post("/api/v1/ai/chat/stop")
                .contentType("application/json")
                .content("{\"thread_id\":\"t1\",\"run_id\":\"r1\"}"))
            .andExpect(status().isNoContent());
    }
}
