import { Link } from 'react-router-dom';
import './Navbar.css';

function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          Clumsy Aztecs
        </Link>
        <div className="navbar-links">
          <Link to="/found" className="navbar-link">
            I found a card
          </Link>
          <Link to="/status" className="navbar-link">
            Retrieve card
          </Link>
          <Link to="/admin" className="navbar-link">
            Admin
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;

