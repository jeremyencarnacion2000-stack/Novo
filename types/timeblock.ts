export type TimeBlockType = 'task' | 'project_deadline' | 'google_event' | 'cognitive_rest' | 'routine';
export type EnergyLevel = 'high' | 'medium' | 'low';
export type TimeBlockStatus = 'pending' | 'completed';

export interface TimeBlock {
  id: string;
  title: string;
  type: TimeBlockType;
  startTime: Date;
  endTime: Date;
  googleEventId: string | null;
  projectId: string | null;
  routineId: string | null;
  energyRequired: EnergyLevel;
  status: TimeBlockStatus;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTimeBlockDTO {
  title: string;
  type: TimeBlockType;
  startTime: Date | string;
  endTime: Date | string;
  projectId?: string | null;
  routineId?: string | null;
  energyRequired?: EnergyLevel;
  status?: TimeBlockStatus;
}
