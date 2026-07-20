export interface TeamSearchQuery {
  eventId: string;
  page?: number;
  limit?: number;
  cursor?: string;
  visibility?: string;
  recruiting?: boolean;
  skills?: string[];
  language?: string;
  timezone?: string;
  tags?: string[];
  sort?: string;
}
