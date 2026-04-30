import { Router } from 'express';

import { transactionInputSchema } from '../lib/transaction-schema.js';
import {
  createTransaction,
  deleteTransaction,
  listOpenPositions,
  listTransactions,
  updateTransaction
} from '../lib/transactions-service.js';

export const transactionsRouter = Router();

transactionsRouter.get('/', async (_req, res) => {
  const payload = await listTransactions();
  res.json(payload);
});

transactionsRouter.get('/open', async (_req, res) => {
  const items = await listOpenPositions();
  res.json({ items });
});

transactionsRouter.post('/', async (req, res) => {
  const parsed = transactionInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Invalid transaction payload.',
      issues: parsed.error.flatten()
    });
  }

  const transaction = await createTransaction(parsed.data);
  return res.status(201).json(transaction);
});

transactionsRouter.patch('/:id', async (req, res) => {
  const parsed = transactionInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: 'Invalid transaction payload.',
      issues: parsed.error.flatten()
    });
  }

  const transaction = await updateTransaction(req.params.id, parsed.data);
  if (!transaction) {
    return res.status(404).json({ message: 'Transaction not found.' });
  }

  return res.json(transaction);
});

transactionsRouter.delete('/:id', async (req, res) => {
  const deleted = await deleteTransaction(req.params.id);
  if (!deleted) {
    return res.status(404).json({ message: 'Transaction not found.' });
  }

  return res.status(204).send();
});
