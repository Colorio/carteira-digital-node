'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './WalletBalance.module.css';

type Wallet = {
  id: string;
  balance: number;
};

export default function WalletBalance() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadWallet = useCallback(async () => {
    setError('');

    try {
      const token = localStorage.getItem('access_token');

      if (!token) {
        throw new Error('Sessão não encontrada.');
      }

      const response = await fetch('http://localhost:3000/wallets', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.message === 'string'
            ? data.message
            : 'Não foi possível carregar o saldo.',
        );
      }

      setWallet(data);
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

  useEffect(() => {
    loadWallet();

    window.addEventListener('wallet:updated', loadWallet);

    return () => {
      window.removeEventListener('wallet:updated', loadWallet);
    };
  }, [loadWallet]);

  const balance = wallet ? wallet.balance / 100 : 0;

  const formattedBalance = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(balance);

  return (
    <section className="panel">
      <div>
        <h2>Saldo atual</h2>
        {wallet && <small><em>{wallet.id}</em></small>}
      </div>

      {loading && <div>Carregando saldo...</div>}

      {!loading && wallet && (
        <p
          className={`${styles.balance} ${
            balance > 0
              ? styles.balancePositive
              : balance < 0
                ? styles.balanceNegative
                : ''
          }`}
        >
          {formattedBalance}
        </p>
      )}

      {!loading && error && (
        <p className="text-error">{error}</p>
      )}
    </section>
  );
}
