import AppHeader from './components/AppHeader';
import WalletBalance from './components/WalletBalance';
import Deposit from './components/Deposit';
import Transfer from './components/Transfer';
import TransactionList from './components/TransactionList';

export default function Dashboard() {
  return (
    <>
      <AppHeader />

      <main>
        <div>
          <WalletBalance />

          <div className="panel-two-columns">
            <Deposit />
            <Transfer />
          </div>

          <TransactionList />
        </div>
      </main>
    </>
  );
}
