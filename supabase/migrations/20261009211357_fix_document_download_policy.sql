-- Storage does not expose the same internal operation marker in every hosted
-- release. Authorization is therefore based on the private document helper;
-- it still limits every visible object row to an accessible, ready document.
drop policy if exists fontex_documents_download_authorized on storage.objects;

create policy fontex_documents_download_authorized
on storage.objects for select
to authenticated
using (
  bucket_id = 'fontex-documents'
  and (select private.can_download_document_object(name))
);
