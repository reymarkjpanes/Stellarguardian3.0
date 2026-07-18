/**
 * tests/schemas/events.test.ts
 * Unit tests for event validation schemas.
 */
import { describe, it, expect } from 'vitest';
import {
  CreateEventSchema,
  UpdateEventSchema,
  StateTransitionSchema,
  RsvpSchema,
  MembershipStatusSchema,
  CreateMilestoneSchema,
  CreateSponsorSchema,
  SetWinnersSchema,
} from '../../server/schemas/events';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const validCreateEvent = {
  title: 'Stellar Hackathon 2025',
  description: 'Build the future of decentralized finance on Stellar.',
  category: 'Hackathon',
  format: 'Online',
  visibility: 'Public',
  registrationDeadline: '2025-06-01T00:00:00Z',
  startDate: '2025-06-15T00:00:00Z',
  endDate: '2025-06-30T23:59:59Z',
  prizeTotal: 10000,
  prizeBreakdown: '1st: 5000, 2nd: 3000, 3rd: 2000',
  tags: ['stellar', 'defi', 'blockchain'],
  capacity: 500,
  teamSizeMax: 5,
  bannerUrl: 'https://example.com/banner.jpg',
  contactEmail: 'host@example.com',
};

// ─── CreateEventSchema ────────────────────────────────────────────────────────

describe('CreateEventSchema', () => {
  it('accepts valid complete input', () => {
    const result = CreateEventSchema.safeParse(validCreateEvent);
    expect(result.success).toBe(true);
  });

  it('accepts minimal valid input (optional fields omitted)', () => {
    const minimal = {
      title: 'My Event',
      description: 'A detailed description of the event here.',
      category: 'Competition',
      format: 'In-Person',
      visibility: 'Private',
      registrationDeadline: '2025-06-01T00:00:00Z',
      startDate: '2025-06-15T00:00:00Z',
      endDate: '2025-06-30T00:00:00Z',
      prizeTotal: 0,
    };
    const result = CreateEventSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('rejects title shorter than 3 characters', () => {
    const result = CreateEventSchema.safeParse({ ...validCreateEvent, title: 'ab' });
    expect(result.success).toBe(false);
  });

  it('rejects empty description', () => {
    const result = CreateEventSchema.safeParse({ ...validCreateEvent, description: 'short' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid category', () => {
    const result = CreateEventSchema.safeParse({ ...validCreateEvent, category: 'Party' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid format', () => {
    const result = CreateEventSchema.safeParse({ ...validCreateEvent, format: 'Virtual' });
    expect(result.success).toBe(false);
  });

  it('rejects negative prizeTotal', () => {
    const result = CreateEventSchema.safeParse({ ...validCreateEvent, prizeTotal: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects endDate before startDate', () => {
    const result = CreateEventSchema.safeParse({
      ...validCreateEvent,
      startDate: '2025-07-01T00:00:00Z',
      endDate: '2025-06-01T00:00:00Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects registrationDeadline after startDate', () => {
    const result = CreateEventSchema.safeParse({
      ...validCreateEvent,
      registrationDeadline: '2025-07-01T00:00:00Z',
      startDate: '2025-06-15T00:00:00Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid date strings', () => {
    const result = CreateEventSchema.safeParse({
      ...validCreateEvent,
      startDate: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });

  it('accepts tags as a string', () => {
    const result = CreateEventSchema.safeParse({
      ...validCreateEvent,
      tags: 'stellar,defi,blockchain',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid bannerUrl', () => {
    const result = CreateEventSchema.safeParse({
      ...validCreateEvent,
      bannerUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid contactEmail', () => {
    const result = CreateEventSchema.safeParse({
      ...validCreateEvent,
      contactEmail: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('trims whitespace from title and description', () => {
    const result = CreateEventSchema.safeParse({
      ...validCreateEvent,
      title: '  Padded Title  ',
      description: '  Padded description with enough length here.  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Padded Title');
      expect(result.data.description).toBe('Padded description with enough length here.');
    }
  });

  it('defaults teamSizeMax to 4 when omitted', () => {
    const { teamSizeMax, ...rest } = validCreateEvent;
    const result = CreateEventSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.teamSizeMax).toBe(4);
    }
  });
});

// ─── UpdateEventSchema ────────────────────────────────────────────────────────

describe('UpdateEventSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = UpdateEventSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts partial updates', () => {
    const result = UpdateEventSchema.safeParse({ title: 'New Title' });
    expect(result.success).toBe(true);
  });

  it('rejects title too short', () => {
    const result = UpdateEventSchema.safeParse({ title: 'No' });
    expect(result.success).toBe(false);
  });

  it('accepts boolean rulesPublished', () => {
    const result = UpdateEventSchema.safeParse({ rulesPublished: true });
    expect(result.success).toBe(true);
  });

  it('rejects invalid visibility', () => {
    const result = UpdateEventSchema.safeParse({ visibility: 'Secret' });
    expect(result.success).toBe(false);
  });
});

// ─── StateTransitionSchema ────────────────────────────────────────────────────

describe('StateTransitionSchema', () => {
  it('accepts valid state', () => {
    const result = StateTransitionSchema.safeParse({ newState: 'Published' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid state', () => {
    const result = StateTransitionSchema.safeParse({ newState: 'Invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects empty object', () => {
    const result = StateTransitionSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects numeric newState', () => {
    const result = StateTransitionSchema.safeParse({ newState: 123 });
    expect(result.success).toBe(false);
  });
});

// ─── RsvpSchema ───────────────────────────────────────────────────────────────

describe('RsvpSchema', () => {
  it('accepts Going', () => {
    expect(RsvpSchema.safeParse({ status: 'Going' }).success).toBe(true);
  });

  it('accepts Maybe', () => {
    expect(RsvpSchema.safeParse({ status: 'Maybe' }).success).toBe(true);
  });

  it('accepts Not Going', () => {
    expect(RsvpSchema.safeParse({ status: 'Not Going' }).success).toBe(true);
  });

  it('rejects invalid status', () => {
    expect(RsvpSchema.safeParse({ status: 'Attending' }).success).toBe(false);
  });

  it('rejects missing status', () => {
    expect(RsvpSchema.safeParse({}).success).toBe(false);
  });
});

// ─── MembershipStatusSchema ───────────────────────────────────────────────────

describe('MembershipStatusSchema', () => {
  it('accepts accepted', () => {
    expect(MembershipStatusSchema.safeParse({ status: 'accepted' }).success).toBe(true);
  });

  it('accepts rejected', () => {
    expect(MembershipStatusSchema.safeParse({ status: 'rejected' }).success).toBe(true);
  });

  it('accepts pending', () => {
    expect(MembershipStatusSchema.safeParse({ status: 'pending' }).success).toBe(true);
  });

  it('rejects invalid status', () => {
    expect(MembershipStatusSchema.safeParse({ status: 'banned' }).success).toBe(false);
  });
});

// ─── CreateMilestoneSchema ────────────────────────────────────────────────────

describe('CreateMilestoneSchema', () => {
  it('accepts valid milestone', () => {
    const result = CreateMilestoneSchema.safeParse({
      title: 'Kickoff',
      date: '2025-06-01T00:00:00Z',
      description: 'Project kickoff meeting',
    });
    expect(result.success).toBe(true);
  });

  it('accepts milestone without description', () => {
    const result = CreateMilestoneSchema.safeParse({
      title: 'Deadline',
      date: '2025-07-01T00:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    const result = CreateMilestoneSchema.safeParse({
      title: '',
      date: '2025-06-01T00:00:00Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid date', () => {
    const result = CreateMilestoneSchema.safeParse({
      title: 'Test',
      date: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });
});

// ─── CreateSponsorSchema ──────────────────────────────────────────────────────

describe('CreateSponsorSchema', () => {
  it('accepts valid sponsor', () => {
    const result = CreateSponsorSchema.safeParse({
      name: 'Stellar Foundation',
      logo: 'https://stellar.org/logo.png',
      tier: 'Gold',
    });
    expect(result.success).toBe(true);
  });

  it('accepts sponsor without logo', () => {
    const result = CreateSponsorSchema.safeParse({
      name: 'Acme Corp',
      tier: 'Silver',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = CreateSponsorSchema.safeParse({
      name: '',
      tier: 'Bronze',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid logo URL', () => {
    const result = CreateSponsorSchema.safeParse({
      name: 'Test',
      logo: 'not-a-url',
      tier: 'Gold',
    });
    expect(result.success).toBe(false);
  });
});

// ─── SetWinnersSchema ─────────────────────────────────────────────────────────

describe('SetWinnersSchema', () => {
  it('accepts valid winners array', () => {
    const result = SetWinnersSchema.safeParse({
      winners: [
        { submissionId: 1, rank: 1, prizeAmount: 5000 },
        { submissionId: 2, rank: 2, prizeAmount: 3000 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty winners array', () => {
    const result = SetWinnersSchema.safeParse({ winners: [] });
    expect(result.success).toBe(false);
  });

  it('rejects negative prizeAmount', () => {
    const result = SetWinnersSchema.safeParse({
      winners: [{ submissionId: 1, rank: 1, prizeAmount: -100 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects rank of 0', () => {
    const result = SetWinnersSchema.safeParse({
      winners: [{ submissionId: 1, rank: 0, prizeAmount: 1000 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer submissionId', () => {
    const result = SetWinnersSchema.safeParse({
      winners: [{ submissionId: 1.5, rank: 1, prizeAmount: 1000 }],
    });
    expect(result.success).toBe(false);
  });
});
