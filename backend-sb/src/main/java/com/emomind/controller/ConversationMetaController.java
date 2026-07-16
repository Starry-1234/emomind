package com.emomind.controller;

import com.emomind.dto.request.ConversationMetaCreateRequest;
import com.emomind.dto.response.ConversationMetaResponse;
import com.emomind.entity.ConversationMeta;
import com.emomind.repository.ConversationMetaRepository;
import com.emomind.repository.UserRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/ai/conversations")
public class ConversationMetaController {

    private final ConversationMetaRepository repo;
    private final UserRepository userRepo;

    public ConversationMetaController(ConversationMetaRepository repo, UserRepository userRepo) {
        this.repo = repo;
        this.userRepo = userRepo;
    }

    /**
     * Idempotent upsert keyed by (user_id, graph, thread_id). On first call
     * creates a new row; subsequent calls update title/metadata in place.
     */
    @PostMapping
    public ResponseEntity<ConversationMetaResponse> create(
            @Valid @RequestBody ConversationMetaCreateRequest req) {
        UUID userId = currentUserId();
        if (userId == null) return ResponseEntity.status(401).build();

        ConversationMeta m = repo
                .findByUserIdAndGraphAndThreadId(userId, req.graph(), req.thread_id())
                .orElseGet(() -> ConversationMeta.builder()
                        .owner(userRepo.getReferenceById(userId))
                        .graph(req.graph())
                        .threadId(req.thread_id())
                        .title(req.title())
                        .metadata(req.metadata() != null ? req.metadata() : Map.of())
                        .build());
        m.setTitle(req.title());
        m.setMetadata(req.metadata() != null ? req.metadata() : Map.of());

        ConversationMeta saved = repo.save(m);
        return ResponseEntity.ok(toDto(saved));
    }

    @GetMapping(params = {"graph", "thread_id"})
    public ResponseEntity<ConversationMetaResponse> getByThread(
            @RequestParam String graph,
            @RequestParam("thread_id") String threadId) {
        UUID userId = currentUserId();
        if (userId == null) return ResponseEntity.status(401).build();
        return repo.findByUserIdAndGraphAndThreadId(userId, graph, threadId)
                .map(m -> ResponseEntity.ok(toDto(m)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<List<ConversationMetaResponse>> list(
            @RequestParam(required = false) String graph) {
        UUID userId = currentUserId();
        if (userId == null) return ResponseEntity.status(401).build();
        List<ConversationMeta> entities = (graph == null)
                ? repo.findAll().stream()
                    .filter(m -> m.getOwner().getId().equals(userId))
                    .toList()
                : repo.findByUserIdAndGraph(userId, graph);
        return ResponseEntity.ok(entities.stream().map(this::toDto).toList());
    }

    private ConversationMetaResponse toDto(ConversationMeta m) {
        return new ConversationMetaResponse(
                m.getId(),
                m.getGraph(),
                m.getThreadId(),
                m.getTitle(),
                m.getMetadata(),
                m.getCreatedAt(),
                m.getUpdatedAt()
        );
    }

    private UUID currentUserId() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !a.isAuthenticated() || "anonymousUser".equals(a.getPrincipal())) {
            return null;
        }
        Object p = a.getPrincipal();
        if (p instanceof com.emomind.security.UserDetailsImpl u) return u.getId();
        return UUID.fromString(a.getName());
    }
}
