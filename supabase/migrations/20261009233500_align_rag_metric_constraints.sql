begin;

alter table public.document_processing_jobs
  drop constraint if exists document_processing_jobs_extracted_characters_check,
  drop constraint if exists document_processing_jobs_chunk_count_check,
  drop constraint if exists document_processing_jobs_embedding_tokens_check,
  drop constraint if exists document_processing_jobs_failure_count_check;

alter table public.document_processing_jobs
  add constraint document_processing_jobs_extracted_characters_check
    check (extracted_characters between 0 and 1000000),
  add constraint document_processing_jobs_chunk_count_check
    check (chunk_count between 0 and 1000),
  add constraint document_processing_jobs_embedding_tokens_check
    check (embedding_tokens between 0 and 250000),
  add constraint document_processing_jobs_failure_count_check
    check (failure_count between 0 and 10);

commit;
