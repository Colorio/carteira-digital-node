'use client';

import Swal from 'sweetalert2';
import styles from './TransactionItem.module.css';

type WalletTransaction = {
  id: string;
  transaction_id: string;
  type: 'DEPOSIT' | 'TRANSFER' | 'REVERSAL';
  status: 'COMPLETED' | 'REVERSED';
  direction: 'credit' | 'debit';
  amount: string;
  created_at: string;
  counterparty: {
    name: string;
    email: string;
  } | null;
};

type TransactionItemProps = {
  transaction: WalletTransaction;
  reversing: boolean;
  onReverse: () => void;
};

export default function TransactionItem({
  transaction,
  reversing,
  onReverse,
}: TransactionItemProps) {
  const canReverse =
    transaction.status === 'COMPLETED' &&
    (
      transaction.type === 'DEPOSIT' ||
      (
        transaction.type === 'TRANSFER' &&
        transaction.direction === 'debit'
      )
    );

  function transactionTitle() {
    if (transaction.type === 'DEPOSIT') {
      return 'Depósito';
    }

    if (transaction.type === 'TRANSFER') {
      const action = transaction.direction === 'debit'
        ? 'Transferência enviada'
        : 'Transferência recebida';

      return transaction.counterparty
        ? `${action} ${transaction.direction === 'debit' ? 'para' : 'de'} ${transaction.counterparty.name}`
        : action;
    }

    return 'Estorno';
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(date));
  }

  function formatAmount() {
    const value = Number(transaction.amount) / 100;

    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(
      transaction.direction === 'debit' ? -value : value,
    );
  }

  async function confirmReverse() {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Confirmar estorno?',
      html: `
        <p>${transactionTitle()}</p>
        <strong>${formatAmount()}</strong>
        <p>Essa operação não poderá ser desfeita automaticamente.</p>
      `,
      showCancelButton: true,
      confirmButtonText: 'Confirmar estorno',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    });

    if (result.isConfirmed) {
      onReverse();
    }
  }

  return (
    <div className={styles.transactionItem}>
      <div>
        <small>
          {transaction.status === 'COMPLETED' ? 'Concluída' : 'Revertida'}
        </small>

        <p>{transactionTitle()}</p>

        <small>{formatDate(transaction.created_at)}</small>

        {canReverse && (
          <div>
            <button
              type="button"
              disabled={reversing}
              onClick={confirmReverse}
            >
              {reversing ? 'Estornando...' : 'Estornar'}
            </button>
          </div>
        )}
      </div>

      <div className={styles.amount}>
        <p
          className={`${transaction.direction === 'credit' ? 'text-credit' : 'text-debit'} ${
            transaction.status !== 'COMPLETED' ? styles.lineThrough : ''
          }`}
        >
          <strong>{formatAmount()}</strong>
        </p>
      </div>
    </div>
  );
}
