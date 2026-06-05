import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { processFocusSession } from "@/lib/inngest/functions/process-focus-session";
import { processDailyInsights } from "@/lib/inngest/functions/daily-insights";
import { reengageInactiveUsers } from "@/lib/inngest/functions/user-reengagement";
import { processTwinSignal } from "@/lib/inngest/functions/process-twin-signal";

// Create an API that serves zero-dependency functions
export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [
        processFocusSession,
        processDailyInsights,
        reengageInactiveUsers,
        processTwinSignal
    ],
});
