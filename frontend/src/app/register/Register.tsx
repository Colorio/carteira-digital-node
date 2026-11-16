'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './Register.module.css';

export default function Register() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  function formatCpf(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 11);

    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage('');

    if (password !== passwordConfirmation) {
      setErrorMessage('As senhas não coincidem.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          cpf: cpf.replace(/\D/g, ''),
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join('\n')
            : data.message || 'Não foi possível realizar o cadastro.',
        );
      }

      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      router.push('/dashboard');
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Ocorreu um erro inesperado.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={`panel ${styles.registerPanel}`}>
      <section>
        <div className={`panel-header ${styles.panelHeader}`}>
          <img src="/logofull.svg" alt="Logo Carteira Digital" />
          <h2>Comece a usar sua Carteira Digital</h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-item">
            <label htmlFor="name">Nome</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoComplete="name"
            />
          </div>

          <div className="form-item">
            <label htmlFor="cpf">CPF</label>
            <input
              id="cpf"
              type="text"
              value={cpf}
              onChange={(event) => setCpf(formatCpf(event.target.value))}
              required
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
            />
          </div>

          <div className="form-item">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-item">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div className="form-item">
            <label htmlFor="password_confirmation">Confirmar senha</label>
            <input
              id="password_confirmation"
              type="password"
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          {errorMessage && (
            <p className={`text-error ${styles.errorMessage}`}>
              {errorMessage}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>

        <p className={styles.loginButton}>
          Já tem uma conta? <Link href="/">Entrar</Link>
        </p>
      </section>
    </main>
  );
}
