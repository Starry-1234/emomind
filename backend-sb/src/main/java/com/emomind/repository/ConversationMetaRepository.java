package com.emomind.repository;

import com.emomind.entity.ConversationMeta;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConversationMetaRepository extends JpaRepository<ConversationMeta, UUID> {

    @Query("select m from ConversationMeta m " +
           "where m.owner.id = ?1 and m.graph = ?2 and m.threadId = ?3")
    Optional<ConversationMeta> findByUserIdAndGraphAndThreadId(
            UUID userId, String graph, String threadId);

    @Query("select m from ConversationMeta m " +
           "where m.owner.id = ?1 and m.graph = ?2 " +
           "order by m.updatedAt desc")
    List<ConversationMeta> findByUserIdAndGraph(UUID userId, String graph);
}
