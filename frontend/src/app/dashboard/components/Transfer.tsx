'use client';

import { FormEvent, useState } from 'react';
import Swal from 'sweetalert2';

export default function Transfer() {
  const [recipient, setRecipient] = useState('');
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
    const formattedRecipient = recipient.trim();

    if (!amountInCents || amountInCents < 1) {
      await Swal.fire({
        icon: 'warning',
        title: 'Valor inválido',
        text: 'Informe um valor válido, maior que zero e com até duas casas decimais.',
      });
      return;
    }

    if (amountInCents > 2000000) {
      await Swal.fire({
        icon: 'warning',
        title: 'Valor excedido',
        text: 'O valor máximo para transferência é R$ 20.000,00.',
      });
      return;
    }

    if (!formattedRecipient) {
      await Swal.fire({
        icon: 'warning',
        title: 'Destinatário obrigatório',
        text: 'Informe o CPF, e-mail ou ID da carteira de destino.',
      });
      return;
    }

    const formattedAmount = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amountInCents / 100);

    const confirmation = await Swal.fire({
      icon: 'question',
      title: 'Confirmar transferência?',
      html: `Deseja transferir <strong>${formattedAmount}</strong> para <strong>${formattedRecipient}</strong>?`,
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
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

      const response = await fetch('http://localhost:3000/wallets/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipient: formattedRecipient,
          amount: amountInCents,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join('\n')
            : data.message || 'Não foi possível realizar a transferência.',
        );
      }

      setRecipient('');
      setAmount('');

      window.dispatchEvent(new Event('wallet:updated'));
      window.dispatchEvent(new Event('transactions:updated'));

      await Swal.fire({
        icon: 'success',
        title: 'Transferência realizada!',
        text: 'O valor foi enviado com sucesso.',
        confirmButtonText: 'Fechar',
      });
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Erro ao realizar transferência',
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
      <h2>Realizar transferência</h2>

      <p>Envie dinheiro para outra carteira.</p>

      <form onSubmit={submit}>
        <div className="form-item">
          <label htmlFor="recipient-wallet">
            Destinatário
          </label>
          <input
            id="recipient-wallet"
            type="text"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            required
            placeholder="CPF, e-mail ou UUID da carteira"
          />
        </div>

        <div className="form-item">
          <label htmlFor="transfer-amount">
            Valor da transferência
          </label>

          <div className="input-currency">
            <span>R$</span>
            <input
              id="transfer-amount"
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(formatAmount(event.target.value))}
              placeholder="0,00"
              required
            />
          </div>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Transferindo...' : 'Transferir'}
        </button>
      </form>
    </section>
  );
}
