import { useEffect, useState } from 'react';
import './App.css';

interface Statement {
  id: string;
  fileName: string;
  uploadedAt: string;
  transactionCount: number;
}

function App() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('http://localhost:5034/api/statements')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setStatements(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="container"><p>Loading...</p></div>;
  if (error) return <div className="container"><p>Error: {error}</p></div>;

  return (
    <div className="container">
      <h1>NOSYOR.M.I</h1>
      <p className="tagline">A mirror for your money.</p>

      <h2>Uploaded Statements</h2>
      {statements.length === 0 ? (
        <p>No statements yet.</p>
      ) : (
        <ul className="statement-list">
          {statements.map(s => (
            <li key={s.id} className="statement-item">
              <strong>{s.fileName}</strong>
              <span>{s.transactionCount} transactions</span>
              <span className="date">
                {new Date(s.uploadedAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;