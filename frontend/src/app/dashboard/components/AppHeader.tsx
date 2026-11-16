'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './AppHeader.module.css';

type User = {
  id: string;
  name: string;
  email: string;
};

export default function AppHeader() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');

    if (!storedUser) {
      router.replace('/');
      return;
    }

    try {
      setUser(JSON.parse(storedUser));
    } catch {
      localStorage.removeItem('user');
      localStorage.removeItem('access_token');
      router.replace('/');
    }
  }, [router]);

  function logout() {
    setLoading(true);

    localStorage.removeItem('access_token');
    localStorage.removeItem('user');

    router.replace('/');
  }

  return (
    <header className={styles.header}>
      <img src="/logofull.svg" alt="Logo Carteira Digital" />

      <div className={styles.user}>
        <p>{user?.name}</p>

        <button
          type="button"
          disabled={loading}
          onClick={logout}
        >
          {loading ? 'Saindo...' : 'Sair'}
        </button>
      </div>
    </header>
  );
}
