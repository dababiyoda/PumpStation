import { render, screen } from '@testing-library/react';
import CoinTracker from '../CoinTracker';

test('renders currency selector', () => {
  render(<CoinTracker />);
  expect(screen.getByLabelText(/currency/i)).toBeInTheDocument();
});
