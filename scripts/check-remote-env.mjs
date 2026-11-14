// These integration suites create and remove isolated QA users, classrooms and documents.
const required = ['SUPABASE_TEST_URL', 'SUPABASE_TEST_PUBLISHABLE_KEY', 'SUPABASE_TEST_SERVICE_ROLE_KEY'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Remote tests require: ${missing.join(', ')}. See docs/primitivas-v0.7.1.md.`);
  process.exit(1);
}
