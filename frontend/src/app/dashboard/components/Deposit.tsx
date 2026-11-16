'use client';

import { FormEvent, useState } from 'react';
import Swal from 'sweetalert2';

export default function Deposit() {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  function formatAmount(value: string) {
    const digits = value.replace(/\D/g, '');

    if (!digits) {
      return '';
    }

    return (Number(digits) / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const amountInCents = Number(amount.replace(/\D/g, ''));

    if (!amountInCents || amountInCents < 1) {
      await Swal.fire({
        icon: 'warning',
        title: 'Valor inválido',
        text: 'Informe um valor válido.',
        customClass: {
          confirmButton: 'swal-confirm-button',
          cancelButton: 'swal-cancel-button',
        },
      });
      return;
    }

    if (amountInCents > 9999999) {
      await Swal.fire({
        icon: 'warning',
        title: 'Valor excedido',
        text: 'O valor máximo para depósito é R$ 99.999,99.',
        customClass: {
          confirmButton: 'swal-confirm-button',
          cancelButton: 'swal-cancel-button',
        },
      });
      return;
    }

    const formattedAmount = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amountInCents / 100);

    const confirmation = await Swal.fire({
      icon: 'question',
      title: 'Confirmar depósito?',
      text: `Deseja realizar um depósito de ${formattedAmount}?`,
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      customClass: {
        confirmButton: 'swal-confirm-button',
        cancelButton: 'swal-cancel-button',
      },
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('access_token');

      if (!token) {
        throw new Error('Sessão não encontrada.');
      }

      const response = await fetch('http://localhost:3000/wallets/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: amountInCents,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join('\n')
            : data.message || 'Não foi possível realizar o depósito.',
        );
      }

      setAmount('');

      window.dispatchEvent(new Event('wallet:updated'));
      window.dispatchEvent(new Event('transactions:updated'));

      await Swal.fire({
        icon: 'success',
        title: 'Depósito realizado!',
        text: 'O valor foi adicionado à sua carteira.',
        confirmButtonText: 'Fechar',
        customClass: {
          confirmButton: 'swal-confirm-button',
          cancelButton: 'swal-cancel-button',
        },
      });
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Erro ao realizar depósito',
        text:
          error instanceof Error
            ? error.message
            : 'Ocorreu um erro inesperado.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel">
      <h2>Realizar depósito</h2>

      <form onSubmit={submit}>
        <div className="form-item">
          <label htmlFor="deposit-amount">
            Valor do depósito
          </label>
          <div className="input-currency">
            <span>R$</span>
            <input
              id="deposit-amount"
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(event) => {
                setAmount(formatAmount(event.target.value));
              }}
              placeholder="0,00"
              required
            />
          </div>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Depositando...' : 'Depositar'}
        </button>
      </form>
    </section>
  );
}