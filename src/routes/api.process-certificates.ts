import { json } from '@tanstack/react-start';
import { createAPIFileRoute } from '@tanstack/react-start/api';
import { processCertificateQueue } from '@/lib/certificate-generator';

export const APIRoute = createAPIFileRoute('/api/process-certificates')({
  GET: async () => {
    try {
      const result = await processCertificateQueue();
      return json(result);
    } catch (error) {
      console.error('Certificate processing error:', error);
      return json(
        {
          processed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  },
  POST: async () => {
    try {
      const result = await processCertificateQueue();
      return json(result);
    } catch (error) {
      console.error('Certificate processing error:', error);
      return json(
        {
          processed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  },
});
