import { z } from 'zod';

const nullableTrimmedString = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

const nullableNumber = z.union([z.number(), z.null()]);

export const transactionInputSchema = z.object({
  positionGroup: nullableTrimmedString,
  dateOpened: z.string().min(1),
  expiration: nullableTrimmedString,
  closeDate: nullableTrimmedString,
  stock: z.string().trim().min(1),
  positionSide: z.enum(['Long', 'Short']),
  strategyType: z.string().trim().min(1),
  strikes: nullableTrimmedString,
  contracts: z.number().positive(),
  openingPrice: nullableNumber,
  closingPrice: nullableNumber,
  fees: z.number(),
  profit: nullableNumber,
  winLoss: z.enum(['Win', 'Loss']).nullable(),
  broker: nullableTrimmedString,
  botOpened: z.boolean(),
  tags: z.array(z.string()).default([]),
  reviewNotes: nullableTrimmedString,
  lessonLearned: nullableTrimmedString,
  exitReason: nullableTrimmedString,
  profitTarget: nullableNumber,
  stopLoss: nullableNumber,
  maxRisk: nullableNumber,
  notes: nullableTrimmedString
});
