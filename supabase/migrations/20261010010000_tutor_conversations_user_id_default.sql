-- Add auth.uid() default to tutor_conversations and tutor_messages user_id
alter table public.tutor_conversations
  alter column user_id set default auth.uid();

alter table public.tutor_messages
  alter column user_id set default auth.uid();
