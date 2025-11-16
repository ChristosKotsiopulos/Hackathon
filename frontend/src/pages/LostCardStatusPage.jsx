import { useState } from 'react';
import './LostCardStatusPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function LostCardStatusPage() {
  const [cardId, setCardId] = useState('');
  const [loading, setLoading] = useState(false);
  const [card, setCard] = useState(null);
  const [error, setError] = useState(null);
  const [pickupCode, setPickupCode] = useState('');
  const [pickupLoading, setPickupLoading] = useState(false);
  const [pickupError, setPickupError] = useState(null);
  const [pickupSuccess, setPickupSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!cardId.trim()) {
      setError('Please enter a card ID');
      return;
    }

    setLoading(true);
    setError(null);
    setCard(null);

    try {
      const response = await fetch(`${API_URL}/api/cards/${cardId}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch card status' }));
        if (response.status === 404) {
          throw new Error(errorData.error || 'Card not found');
        }
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      setCard(data);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const getStatusDisplay = (status) => {
    const statusMap = {
      waiting_for_email: { text: 'Waiting for Email Lookup', color: '#f39c12' },
      email_sent: { text: 'Email Sent - Ready for Pickup', color: '#3498db' },
      notified_owner: { text: 'Owner Notified', color: '#3498db' },
      picked_up: { text: '✅ Picked Up', color: '#27ae60' }
    };
    return statusMap[status] || { text: status, color: '#95a5a6' };
  };

  return (
    <div className="lost-card-status-page">
      <h1>Retrieve Card</h1>
      <p className="page-description">
        Enter your reference code to retrieve your lost card.
      </p>

      <form onSubmit={handleSubmit} className="status-form">
        <div className="form-group">
          <label htmlFor="cardId" className="form-label">
            Reference Code
          </label>
          <input
            type="text"
            id="cardId"
            value={cardId}
            onChange={(e) => setCardId(e.target.value.toUpperCase())}
            className="form-input"
            placeholder="Enter your reference code (e.g., A33CDB0D)"
            required
            maxLength={8}
            style={{ textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: '0.1em' }}
          />
          <p className="form-help-text">
            Your reference code is the 8-character code you received when you reported the found card.
          </p>
        </div>
        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? 'Retrieving...' : 'Retrieve Card'}
        </button>
      </form>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {card && (
        <div className="card-status-card">
          <h2>Card Status</h2>
          <div className="status-badge" style={{
            backgroundColor: getStatusDisplay(card.status).color
          }}>
            {getStatusDisplay(card.status).text}
          </div>

          <div className="card-details">
            <div className="detail-row">
              <span className="detail-label">Reference Code:</span>
              <span className="detail-value" style={{ fontFamily: 'monospace', fontWeight: 600, color: '#C41230' }}>
                {card.id.substring(0, 8).toUpperCase()}
              </span>
            </div>

            {card.redId && (
              <div className="detail-row">
                <span className="detail-label">RedID:</span>
                <span className="detail-value" style={{ fontFamily: 'monospace', fontWeight: 600 }}>{card.redId}</span>
              </div>
            )}

            {card.fullName && (
              <div className="detail-row">
                <span className="detail-label">Name:</span>
                <span className="detail-value">{card.fullName}</span>
              </div>
            )}

            {card.locationDescription && (
              <div className="detail-row">
                <span className="detail-label">Found at:</span>
                <span className="detail-value">{card.locationDescription}</span>
              </div>
            )}

            {card.boxId && (
              <div className="detail-row">
                <span className="detail-label">Box:</span>
                <span className="detail-value">{card.boxId}</span>
              </div>
            )}

            {card.finderContact && (
              <div className="detail-row">
                <span className="detail-label">Contact:</span>
                <span className="detail-value">{card.finderContact}</span>
              </div>
            )}

            <div className="detail-row">
              <span className="detail-label">Found on:</span>
              <span className="detail-value">
                {new Date(card.createdAt).toLocaleString()}
              </span>
            </div>

            {card.pickedUpAt && (
              <div className="detail-row">
                <span className="detail-label">Taken out on:</span>
                <span className="detail-value">
                  {new Date(card.pickedUpAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {(card.status === 'email_sent' || card.status === 'notified_owner') && card.boxId && card.pickupCode && !pickupSuccess && (
            <div className="pickup-instructions">
              <h3>📦 Enter Pickup Code</h3>
              <p>Go to <strong>{card.boxId}</strong> and enter your pickup code to open the box.</p>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!pickupCode.trim()) {
                  setPickupError('Please enter your pickup code');
                  return;
                }

                setPickupLoading(true);
                setPickupError(null);
                setPickupSuccess(false);

                try {
                  const response = await fetch(`${API_URL}/api/pickup-request`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      pickupCode: pickupCode.trim(),
                      boxId: card.boxId
                    })
                  });

                  const data = await response.json();

                  if (data.ok) {
                    setPickupSuccess(true);
                    setPickupCode('');
                    // Wait a moment for Arduino to open, then refresh card status
                    setTimeout(async () => {
                      const cardResponse = await fetch(`${API_URL}/api/cards/${cardId}`);
                      if (cardResponse.ok) {
                        const updatedCard = await cardResponse.json();
                        setCard(updatedCard);
                      }
                    }, 3000); // Wait 3 seconds for Arduino to open and confirm
                  } else {
                    setPickupError(data.reason === 'invalid_code' ? 'Invalid pickup code. Please check and try again.' : 'Failed to verify pickup code.');
                  }
                } catch (err) {
                  setPickupError('Failed to verify pickup code. Please try again.');
                } finally {
                  setPickupLoading(false);
                }
              }}>
                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label htmlFor="pickupCode" className="form-label">
                    Pickup Code
                  </label>
                  <input
                    type="text"
                    id="pickupCode"
                    value={pickupCode}
                    onChange={(e) => {
                      // Only allow digits 1, 2, 3, 4
                      const value = e.target.value.replace(/[^1-4]/g, '');
                      setPickupCode(value);
                    }}
                    className="form-input"
                    placeholder="Enter 4-digit code (1-4)"
                    maxLength={4}
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '1.5em',
                      textAlign: 'center',
                      letterSpacing: '0.2em',
                      fontWeight: 'bold'
                    }}
                    required
                  />
                  <p className="form-help-text">
                    Enter the pickup code you received in your email
                  </p>
                </div>
                {pickupError && (
                  <div className="error-message" style={{ marginTop: '0.5rem' }}>
                    {pickupError}
                  </div>
                )}
                <button
                  type="submit"
                  className="submit-button"
                  disabled={pickupLoading || !pickupCode.trim()}
                  style={{ marginTop: '1rem', width: '100%' }}
                >
                  {pickupLoading ? 'Verifying...' : 'Open Box'}
                </button>
              </form>
            </div>
          )}

          {pickupSuccess && (
            <div className="pickup-instructions" style={{ backgroundColor: '#e8f5e9', borderLeftColor: '#27ae60' }}>
              <h3>✅ Box Opened!</h3>
              <p>The box should now be open. Please retrieve your card.</p>
            </div>
          )}

          {card.status === 'picked_up' && (
            <div className="pickup-instructions" style={{ backgroundColor: '#e8f5e9', borderLeftColor: '#27ae60' }}>
              <h3>✅ Card Retrieved</h3>
              <p>This card has been successfully picked up from the box.</p>
            </div>
          )}

          {card.status === 'notified_owner' && card.finderContact && (
            <div className="pickup-instructions">
              <h3>Contact Information</h3>
              <p>Contact this person to arrange pickup: <strong>{card.finderContact}</strong></p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default LostCardStatusPage;

