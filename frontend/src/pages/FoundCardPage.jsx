import { useState, useRef } from 'react';
import './FoundCardPage.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function FoundCardPage() {
  const [formData, setFormData] = useState({
    cardImage: null,
    finderContact: '',
    locationDescription: '',
    boxId: '',
    manualRedId: ''
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({ ...prev, cardImage: file }));
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera on mobile
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (err) {
      setError('Could not access camera. Please allow camera permissions or upload a file instead.');
      console.error('Camera error:', err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0);

      canvas.toBlob((blob) => {
        const file = new File([blob], 'card-photo.jpg', { type: 'image/jpeg' });
        setFormData(prev => ({ ...prev, cardImage: file }));
        setImagePreview(canvas.toDataURL());
        stopCamera();
      }, 'image/jpeg', 0.9);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.cardImage) {
      setError('Please upload a photo of the card');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('cardImage', formData.cardImage);
      if (formData.finderContact) {
        formDataToSend.append('finderContact', formData.finderContact);
      }
      if (formData.locationDescription) {
        formDataToSend.append('locationDescription', formData.locationDescription);
      }
      if (formData.boxId) {
        formDataToSend.append('boxId', formData.boxId);
      }
      if (formData.manualRedId) {
        formDataToSend.append('manualRedId', formData.manualRedId);
      }

      const response = await fetch(`${API_URL}/api/found-card-photo`, {
        method: 'POST',
        body: formDataToSend
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to submit card' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log('📥 Response from server:', data); // Debug log
      console.log('📥 emailSent:', data.emailSent, 'emailAddress:', data.emailAddress); // Debug log
      setResult(data);

      // Reset form
      setFormData({
        cardImage: null,
        finderContact: '',
        locationDescription: '',
        boxId: '',
        manualRedId: ''
      });
      e.target.reset();
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="found-card-page">
      <h1>I Found a Card</h1>
      <p className="page-description">
        Upload a photo of the student ID card you found. We'll automatically extract the information and notify the owner.
      </p>

      <form onSubmit={handleSubmit} className="found-card-form">
        <div className="form-group">
          <label htmlFor="cardImage" className="form-label">
            Card Photo <span className="required">*</span>
          </label>

          <div className="image-capture-options">
            <button
              type="button"
              onClick={startCamera}
              className="camera-button"
              disabled={showCamera}
            >
              📷 Take Photo
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (fileInputRef.current) {
                  fileInputRef.current.click();
                }
              }}
              className="upload-button"
            >
              📁 Upload Photo
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            id="cardImage"
            name="cardImage"
            accept="image/*"
            onChange={handleImageChange}
            className="form-input-file"
            style={{ display: 'none' }}
            required
          />

          {showCamera && (
            <div className="camera-container">
              <video ref={videoRef} autoPlay playsInline className="camera-video" />
              <div className="camera-controls">
                <button type="button" onClick={capturePhoto} className="capture-button">
                  📸 Capture
                </button>
                <button type="button" onClick={stopCamera} className="cancel-button">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {imagePreview && !showCamera && (
            <div className="image-preview-container">
              <img
                src={imagePreview}
                alt="Card preview"
                className="image-preview"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (fileInputRef.current) {
                    fileInputRef.current.click();
                  }
                }}
                style={{ cursor: 'pointer' }}
                title="Click to change image"
              />
              <button
                type="button"
                onClick={() => {
                  setImagePreview(null);
                  setFormData(prev => ({ ...prev, cardImage: null }));
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="remove-image-button"
              >
                Remove
              </button>
            </div>
          )}

          {formData.cardImage && !imagePreview && (
            <p className="file-name" style={{ marginTop: '0.75rem', fontSize: '14px', color: '#666' }}>
              Selected file: <strong>{formData.cardImage.name}</strong>
            </p>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="locationDescription" className="form-label">
            Where do you intend to drop it off? (Optional)
          </label>
          <input
            type="text"
            id="locationDescription"
            name="locationDescription"
            value={formData.locationDescription}
            onChange={handleInputChange}
            className="form-input"
            placeholder="e.g., BOX_1, Student Services Building"
          />
        </div>

        <div className="form-group">
          <label htmlFor="finderContact" className="form-label">
            How can the owner contact you? (Optional)
          </label>
          <input
            type="text"
            id="finderContact"
            name="finderContact"
            value={formData.finderContact}
            onChange={handleInputChange}
            className="form-input"
            placeholder="e.g., email@example.com or phone number"
          />
        </div>

        <div className="form-group">
          <label htmlFor="manualRedId" className="form-label">
            RedID (Optional - Manual Entry)
          </label>
          <input
            type="text"
            id="manualRedId"
            name="manualRedId"
            value={formData.manualRedId}
            onChange={handleInputChange}
            className="form-input"
            placeholder="Enter 9-digit RedID (e.g., 123456789)"
            pattern="[0-9]{9}"
            maxLength="9"
          />
          <p className="form-help-text">
            If OCR doesn't detect the RedID automatically, you can enter it manually here. The RedID is typically found in the bottom right corner of the card (in red).
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="boxId" className="form-label">
            Box Location (Optional)
          </label>
          <select
            id="boxId"
            name="boxId"
            value={formData.boxId}
            onChange={handleInputChange}
            className="form-input"
          >
            <option value="">Select a box location...</option>
            <option value="BOX_1">Box 1 - Love Library</option>
            <option value="BOX_2">Box 2 - Student Union</option>
            <option value="BOX_3">Box 3 - Engineering Building</option>
            <option value="BOX_4">Box 4 - Main Campus</option>
          </select>
          <p className="form-help-text">
            If you're placing the card in a pickup box, select the box location. A pickup code will be generated.
          </p>
        </div>

        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit'}
        </button>
      </form>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {result && (
        <div className="success-message">
          <h3>Thank you!</h3>
          <p>{result.message}</p>
          <div className="reference-info">
            <p className="card-id"><strong>Reference Code:</strong> {result.referenceCode}</p>
            {result.redId ? (
              <p className="redid-info"><strong>RedID:</strong> <span className="redid-value">{result.redId}</span></p>
            ) : (
              <p className="redid-info missing"><em>RedID: Not detected (you can enter it manually next time)</em></p>
            )}
            {result.boxId && (
              <p className="box-info"><strong>Box Location:</strong> {result.boxId}</p>
            )}
            {result.emailAddress ? (
              <p className="email-sent-info" style={result.emailSent ? {} : {color: '#e74c3c'}}>
                <strong>{result.emailSent ? 'Email sent to:' : 'Email lookup found:'}</strong> {result.emailAddress}
                {!result.emailSent && ' (but email sending failed)'}
              </p>
            ) : (
              <p className="email-sent-info" style={{color: '#999', fontStyle: 'italic'}}>
                No email mapping found for this RedID
              </p>
            )}
          </div>
          <p className="card-id-small">Full Card ID: {result.cardId}</p>
        </div>
      )}
    </div>
  );
}

export default FoundCardPage;

