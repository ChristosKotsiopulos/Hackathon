import { useState, useEffect } from 'react';
import './AdminPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingCardId, setEditingCardId] = useState(null);
  const [emailInput, setEmailInput] = useState('');
  const [sendingEmail, setSendingEmail] = useState(null);

  // Simple staff login - in production, use proper authentication
  const handleLogin = (e) => {
    e.preventDefault();
    // Simple password check - in production, use proper auth
    if (password === 'sdsu_staff_2024') {
      setIsAuthenticated(true);
      setLoginError('');
      setPassword('');
      // Fetch cards after login
      fetchCards();
    } else {
      setLoginError('Invalid password. Please try again.');
      setPassword('');
    }
  };

  // Fetch cards waiting for email
  const fetchCards = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/cards?status=waiting_for_email`);

      if (!response.ok) {
        throw new Error('Failed to fetch cards');
      }

      const data = await response.json();
      setCards(data);
    } catch (err) {
      setError(err.message || 'Failed to load cards');
    } finally {
      setLoading(false);
    }
  };

  // Only fetch cards if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchCards();
    }
  }, [isAuthenticated]);

  const handleSetEmail = async (cardId) => {
    if (!emailInput.trim() || !emailInput.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setSendingEmail(cardId);
      setError(null);

      const response = await fetch(`${API_URL}/api/cards/${cardId}/set-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailInput.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to set email' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      // Refresh the list
      await fetchCards();

      // Reset form
      setEditingCardId(null);
      setEmailInput('');

      alert(`Email sent successfully to ${data.card.email}!`);
    } catch (err) {
      setError(err.message || 'Failed to set email and send notification');
    } finally {
      setSendingEmail(null);
    }
  };

  const getStatusDisplay = (status) => {
    const statusMap = {
      waiting_for_email: { text: 'Waiting for Email', color: '#f39c12' },
      email_sent: { text: 'Email Sent', color: '#3498db' },
      picked_up: { text: 'Taken Out', color: '#27ae60' }
    };
    return statusMap[status] || { text: status, color: '#95a5a6' };
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="admin-page">
        <div className="login-container">
          <h1>Staff Login</h1>
          <p className="page-description">
            Enter staff password to access the admin panel.
          </p>
          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                placeholder="Enter staff password"
                required
                autoFocus
              />
            </div>
            {loginError && (
              <div className="error-message">
                {loginError}
              </div>
            )}
            <button type="submit" className="submit-button">
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1>Admin - Card Management</h1>
          <p className="page-description">
            Cards waiting for email lookup. Manually look up each student's email in MySDSU, then enter it here to send the notification.
          </p>
        </div>
        <button
          onClick={() => setIsAuthenticated(false)}
          className="logout-button"
        >
          Logout
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="admin-actions">
        <button onClick={fetchCards} className="refresh-button" disabled={loading}>
          {loading ? 'Loading...' : '🔄 Refresh List'}
        </button>
      </div>

      {loading && cards.length === 0 ? (
        <div className="loading-message">Loading cards...</div>
      ) : cards.length === 0 ? (
        <div className="empty-state">
          <p>✅ No cards waiting for email lookup. All caught up!</p>
        </div>
      ) : (
        <div className="cards-list">
          {cards.map((card) => {
            const statusDisplay = getStatusDisplay(card.status);
            const isEditing = editingCardId === card.id;

            return (
              <div key={card.id} className="card-item">
                <div className="card-header">
                  <div className="card-id-small">ID: {card.id.substring(0, 8).toUpperCase()}</div>
                  <span
                    className="status-badge"
                    style={{ backgroundColor: statusDisplay.color }}
                  >
                    {statusDisplay.text}
                  </span>
                </div>

                <div className="card-details">
                  {card.redId && (
                    <div className="detail-row">
                      <strong>RedID:</strong> {card.redId}
                    </div>
                  )}
                  {card.fullName && (
                    <div className="detail-row">
                      <strong>Name:</strong> {card.fullName}
                    </div>
                  )}
                  {card.email && (
                    <div className="detail-row">
                      <strong>Email:</strong> {card.email}
                    </div>
                  )}
                  {card.boxId && (
                    <div className="detail-row">
                      <strong>Box:</strong> {card.boxId}
                    </div>
                  )}
                  {card.pickupCode && (
                    <div className="detail-row">
                      <strong>Pickup Code:</strong> {card.pickupCode}
                    </div>
                  )}
                  {card.locationDescription && (
                    <div className="detail-row">
                      <strong>Location:</strong> {card.locationDescription}
                    </div>
                  )}
                  <div className="detail-row">
                    <strong>Found:</strong> {formatDate(card.createdAt)}
                  </div>
                </div>

                {card.status === 'waiting_for_email' && (
                  <div className="card-actions">
                    {!isEditing ? (
                      <button
                        onClick={() => {
                          setEditingCardId(card.id);
                          setEmailInput('');
                        }}
                        className="set-email-button"
                      >
                        Set Email & Send Notification
                      </button>
                    ) : (
                      <div className="email-input-section">
                        <input
                          type="email"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="Enter student email (from MySDSU)"
                          className="email-input"
                          disabled={sendingEmail === card.id}
                        />
                        <div className="email-actions">
                          <button
                            onClick={() => handleSetEmail(card.id)}
                            className="send-email-button"
                            disabled={sendingEmail === card.id || !emailInput.trim()}
                          >
                            {sendingEmail === card.id ? 'Sending...' : 'Send Email'}
                          </button>
                          <button
                            onClick={() => {
                              setEditingCardId(null);
                              setEmailInput('');
                            }}
                            className="cancel-button"
                            disabled={sendingEmail === card.id}
                          >
                            Cancel
                          </button>
                        </div>
                        <p className="help-text">
                          Look up this student in MySDSU, then paste their email address here.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AdminPage;

