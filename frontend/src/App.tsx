import { RouterProvider } from 'react-router-dom';
import { router } from './routes/router';
import { Toaster } from './components/ui/sonner';
import { AuthProvider } from './context/AuthContext';
import { LiveProvider } from './context/LiveTelemetryContext';

function App() {
  return (
    <AuthProvider>
      <LiveProvider>
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors />
      </LiveProvider>
    </AuthProvider>
  );
}

export default App;
