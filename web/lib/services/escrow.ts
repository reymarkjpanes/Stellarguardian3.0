import "server-only";

import "server-only";

import { FundingService } from "./escrow/funding.service";
import { DisbursementService } from "./escrow/disbursement.service";
import { RefundService } from "./escrow/refund.service";
import { VerificationService } from "./escrow/verification.service";

export { FundingService, DisbursementService, RefundService, VerificationService };

// For backward compatibility while refactoring API routes
export const createEscrowAccount = FundingService.createEscrowAccount;
export const verifyFunding = FundingService.verifyFunding;
export const reconcileEscrow = VerificationService.reconcileEscrow;
export const validatePrizeAllocation = DisbursementService.validatePrizeAllocation;
export const executeDisbursement = DisbursementService.executeDisbursement;
export const executeRefund = RefundService.executeRefund;
export const getEscrowVerification = VerificationService.getEscrowVerification;
