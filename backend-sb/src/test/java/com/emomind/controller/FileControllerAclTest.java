package com.emomind.controller;

import com.emomind.exception.FileAccessDeniedException;
import com.emomind.service.AiProxyService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import reactor.core.publisher.Mono;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

/**
 * M4 T8: MockMvc integration tests for {@link FileController} ACL behavior.
 *
 * <p>The byte-level ACL is enforced inside ai-runtime — Spring's job is just
 * to forward the {@code X-User-Id} header and translate ai-runtime's 403
 * FILE_ACCESS_DENIED into a structured 403 response via
 * {@link FileController#handleFileAccessDenied(FileAccessDeniedException)}.
 *
 * <p>We mock {@link AiProxyService} (no real ai-runtime needed). On a
 * match, the proxy returns the file bytes; on a mismatch, it raises
 * {@link FileAccessDeniedException}.
 *
 * <p>Authentication is driven by {@code @WithMockUser(username = "uuid",
 * roles = "USER")} matching the M1 {@code FileControllerAuthTest} pattern.
 * The {@code FileController.currentUserId()} helper unwraps
 * {@code Authentication#getName()} to a {@code UUID}.
 *
 * <p>The download endpoint returns {@code Mono<ResponseEntity<byte[]>>}, which
 * triggers Spring's async request processing. Each test issues the initial
 * request, then drives the async dispatch so that the resolved value (or
 * error) inside the Mono flows back through Spring's
 * {@code @ExceptionHandler} chain and produces the final response.
 */
@SpringBootTest
@ActiveProfiles("test")
class FileControllerAclTest {

    @Autowired private WebApplicationContext context;
    @MockBean private AiProxyService aiProxyService;

    @Test
    @WithMockUser(username = "00000000-0000-0000-0000-000000000001", roles = "USER")
    void fileDownload_returns_200_on_match() throws Exception {
        byte[] payload = "file-data".getBytes();
        when(aiProxyService.proxyFileDownload(eq("file-1"), any()))
            .thenReturn(Mono.just(payload));

        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context)
            .apply(springSecurity()).build();

        MvcResult started = mvc.perform(get("/api/v1/ai/files/file-1"))
            .andReturn();
        MvcResult result = started.getRequest().isAsyncStarted()
            ? mvc.perform(asyncDispatch(started)).andReturn()
            : started;

        assertEquals(200, result.getResponse().getStatus());
    }

    @Test
    @WithMockUser(username = "00000000-0000-0000-0000-000000000001", roles = "USER")
    void fileDownload_returns_403_on_user_mismatch() throws Exception {
        when(aiProxyService.proxyFileDownload(eq("file-1"), any()))
            .thenReturn(Mono.error(new FileAccessDeniedException("denied")));

        MockMvc mvc = MockMvcBuilders.webAppContextSetup(context)
            .apply(springSecurity()).build();

        MvcResult started = mvc.perform(get("/api/v1/ai/files/file-1"))
            .andReturn();
        MvcResult result = started.getRequest().isAsyncStarted()
            ? mvc.perform(asyncDispatch(started)).andReturn()
            : started;

        assertEquals(403, result.getResponse().getStatus());
    }
}
