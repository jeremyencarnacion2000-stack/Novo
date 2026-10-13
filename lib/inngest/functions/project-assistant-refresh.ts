import {inngest} from '../client'
import {refreshProjectAssistantBatch} from '@/lib/project-assistant/refresh'
export const processProjectAssistantRefresh=inngest.createFunction(
  {id:'project-assistant-refresh',concurrency:{limit:1},retries:2},
  {cron:'*/15 * * * *'},
  async({step})=>step.run('refresh-tracked-projects',()=>refreshProjectAssistantBatch()),
)
