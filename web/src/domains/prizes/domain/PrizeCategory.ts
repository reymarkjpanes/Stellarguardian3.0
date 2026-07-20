export type PrizeType = 'Cash' | 'Token' | 'NFT' | 'Physical' | 'Certificate' | 'Scholarship' | 'Internship';

export interface PrizeCategory {
  id: string;
  eventId: string;
  name: string;
  description: string | null;
  prizeType: PrizeType;
  totalAmount: number;
  currency: string | null;
  maxWinners: number;
  sponsorId: string | null;
}
