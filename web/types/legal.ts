/**
 * Legal acceptance schemas (Req 34).
 * Mirrors the `legal_acceptances` table from design.md.
 */
import { z } from "zod";
import { TimestampSchema, UuidSchema } from "./common";

export const LegalAcceptanceSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  documentType: z.string().min(1),
  documentVersion: z.string().min(1),
  acceptedAt: TimestampSchema,
});
export type LegalAcceptance = z.infer<typeof LegalAcceptanceSchema>;

/** Request body for recording acceptance of a legal document (Req 34.1, 34.5). */
export const AcceptLegalDocumentSchema = z.object({
  documentType: z.string().min(1),
  documentVersion: z.string().min(1),
});
export type AcceptLegalDocument = z.infer<typeof AcceptLegalDocumentSchema>;
