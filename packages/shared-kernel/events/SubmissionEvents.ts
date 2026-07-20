export class SubmissionCreated {
  eventName = "SubmissionCreated";
  constructor(public submissionId: string, public teamId: string, public eventId: string) {}
}

export class DraftUpdated {
  eventName = "DraftUpdated";
  constructor(public submissionId: string, public version: number) {}
}

export class AssetUploaded {
  eventName = "AssetUploaded";
  constructor(public submissionId: string, public assetId: string, public requirementId: string) {}
}

export class AssetDeleted {
  eventName = "AssetDeleted";
  constructor(public submissionId: string, public assetId: string) {}
}

export class SubmissionValidated {
  eventName = "SubmissionValidated";
  constructor(public submissionId: string, public isValid: boolean) {}
}

export class SubmissionSubmitted {
  eventName = "SubmissionSubmitted";
  constructor(public submissionId: string, public submittedAt: Date) {}
}

export class SubmissionLocked {
  eventName = "SubmissionLocked";
  constructor(public submissionId: string, public lockedBy: string) {}
}

export class SubmissionReopened {
  eventName = "SubmissionReopened";
  constructor(public submissionId: string) {}
}

export class SubmissionArchived {
  eventName = "SubmissionArchived";
  constructor(public submissionId: string) {}
}
