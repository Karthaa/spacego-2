// OpenNext Cloudflare adapter config. The app renders every request (no ISR,
// no "use cache"), so it needs no incremental-cache binding.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
