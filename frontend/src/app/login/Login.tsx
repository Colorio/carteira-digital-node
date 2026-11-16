'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './Login.module.css';

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.message === 'string'
            ? data.message
            : 'Não foi possível realizar o login.',
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
    <main className={`panel ${styles.loginPanel}`}>
      <section>
        <div className={`panel-header ${styles.panelHeader}`}>
          <img src="/logofull.svg" alt="Logo Carteira Digital" />
          <h2>Acesse sua conta!</h2>
        </div>

        <form onSubmit={handleSubmit}>
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
              autoComplete="current-password"
            />
          </div>

          {errorMessage && (
            <p className="text-error">{errorMessage}</p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className={styles.registerButton}>
          Ainda não tem conta? <Link href="/register">Cadastre-se</Link>
        </p>
      </section>
    </main>
  );
}
