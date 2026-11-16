'use client';

import { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import TransactionItem from './TransactionItem';
import styles from './TransactionList.module.css';

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

type TransactionResponse = {
  data: WalletTransaction[];
  pagination: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
  };
};

export default function TransactionList() {
  const [items, setItems] = useState<WalletTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reversingId, setReversingId] = useState<string | null>(null);

  const loadTransactions = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('access_token');

      if (!token) {
        throw new Error('Sessão não encontrada.');
      }

      const response = await fetch(
        `http://localhost:3000/transactions?page=${page}&limit=10`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const result: TransactionResponse = await response.json();

      if (!response.ok) {
        throw new Error('Não foi possível carregar as movimentações.');
      }

      setItems(result.data);
      setTotal(result.pagination.total);
      setCurrentPage(result.pagination.current_page);
      setLastPage(result.pagination.last_page);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Ocorreu um erro inesperado.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  async function reverseTransaction(transaction: WalletTransaction) {
    setReversingId(transaction.id);

    try {
      const token = localStorage.getItem('access_token');

      if (!token) {
        throw new Error('Sessão não encontrada.');
      }

      const response = await fetch(
        `http://localhost:3000/transactions/${transaction.transaction_id}/reversal`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join('\n')
            : data.message || 'Não foi possível realizar o estorno.',
        );
      }

      window.dispatchEvent(new Event('wallet:updated'));
      await loadTransactions(currentPage);

      await Swal.fire({
        icon: 'success',
        title: 'Estorno realizado!',
        text: 'A transação foi estornada com sucesso.',
        confirmButtonText: 'Fechar',
        customClass: {
          confirmButton: 'swal-confirm-button',
          cancelButton: 'swal-cancel-button',
        },
      });
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Erro ao realizar estorno',
        text:
          error instanceof Error
            ? error.message
            : 'Ocorreu um erro inesperado.',
        confirmButtonText: 'Fechar',
        customClass: {
          confirmButton: 'swal-confirm-button',
          cancelButton: 'swal-cancel-button',
        },
      });
    } finally {
      setReversingId(null);
    }
  }

  useEffect(() => {
    loadTransactions();

    function handleUpdate() {
      loadTransactions(1);
    }

    window.addEventListener('transactions:updated', handleUpdate);

    return () => {
      window.removeEventListener('transactions:updated', handleUpdate);
    };
  }, [loadTransactions]);

  return (
    <section className="panel">
      <div className={styles.panelTitle}>
        <div>
          <h2>Movimentações</h2>
          <p>Histórico da sua carteira</p>
        </div>

        <span>{total} registro</span>
      </div>

      {loading && <div>Carregando movimentações...</div>}

      {!loading && error && (
        <div>
          <p>{error}</p>
          <button type="button" onClick={() => loadTransactions()}>
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div>
          <p>Nenhuma movimentação encontrada.</p>
          <p>Suas movimentações aparecerão aqui.</p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className={styles.transactionList}>
          {items.map((transaction) => (
            <TransactionItem
              key={transaction.id}
              transaction={transaction}
              reversing={reversingId === transaction.id}
              onReverse={() => reverseTransaction(transaction)}
            />
          ))}
        </div>
      )}

      {lastPage > 1 && (
        <div className={styles.pagination}>
          <button
            type="button"
            disabled={currentPage === 1 || loading}
            onClick={() => loadTransactions(currentPage - 1)}
          >
            Anterior
          </button>

          <span>
            Página {currentPage} de {lastPage}
          </span>

          <button
            type="button"
            disabled={currentPage === lastPage || loading}
            onClick={() => loadTransactions(currentPage + 1)}
          >
            Próxima
          </button>
        </div>
      )}
    </section>
  );
}