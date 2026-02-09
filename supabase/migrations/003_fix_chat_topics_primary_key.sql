-- chat_topics topic IDs are not globally unique across chats.
-- Use composite primary key (chat_id, id) instead of global id key.

ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_topic_id_fkey;

ALTER TABLE chat_topics DROP CONSTRAINT IF EXISTS chat_topics_pkey;
ALTER TABLE chat_topics ADD CONSTRAINT chat_topics_pkey PRIMARY KEY (chat_id, id);
