import { EvaluationLifecycleState, EvaluationStateMachine } from "./EvaluationStateMachine";

export interface CriterionScore {
  criterionId: string;
  score: number;
  maxScore: number;
  weight: number;
  comment?: string;
}

export interface EvaluationScores {
  criteria: CriterionScore[];
}

export interface EvaluationProps {
  id: string;
  submissionId: string;
  judgeId: string;
  eventId: string;
  status: EvaluationLifecycleState;
  scores: EvaluationScores;
  conflictOfInterest: boolean;
  participantFeedback?: string;
  organizerNotes?: string;
  draftNotes?: string;
  totalScore: number;
  rubricVersion?: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class EvaluationAggregate {
  private stateMachine: EvaluationStateMachine;

  constructor(public readonly props: EvaluationProps) {
    this.stateMachine = new EvaluationStateMachine(props.status);
  }

  get id() {
    return this.props.id;
  }
  get status() {
    return this.stateMachine.currentState;
  }
  get scores() {
    return this.props.scores;
  }

  public saveDraft(scores: EvaluationScores, draftNotes?: string) {
    this.props.status = this.stateMachine.transition({ type: "EVALUATION_DRAFT_SAVED" });
    this.props.scores = scores;
    if (draftNotes !== undefined) {
      this.props.draftNotes = draftNotes;
    }
  }

  public submit(
    scores: EvaluationScores,
    participantFeedback?: string,
    organizerNotes?: string,
    calculatedTotalScore: number = 0,
  ) {
    this.props.status = this.stateMachine.transition({ type: "EVALUATION_SUBMITTED" });
    this.props.scores = scores;
    this.props.totalScore = calculatedTotalScore;

    if (participantFeedback !== undefined) this.props.participantFeedback = participantFeedback;
    if (organizerNotes !== undefined) this.props.organizerNotes = organizerNotes;
  }

  public declareConflictOfInterest(reason?: string) {
    this.props.status = this.stateMachine.transition({ type: "CONFLICT_DECLARED" });
    this.props.conflictOfInterest = true;
    if (reason) {
      this.props.organizerNotes = reason;
    }
  }

  public toJSON() {
    return { ...this.props, status: this.status };
  }
}
